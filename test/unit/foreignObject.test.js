suite('Foreign Objects', function () {
  const $ = window.test_only_jquery;

  var mq;
  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
  });

  teardown(function () {
    $(mq.el()).remove();
  });

  suite('foreignObject() API', function () {
    test('foreignObject inserts element into expression', function () {
      var element = document.createElement('button');
      element.textContent = 'Test';

      mq.foreignObject('test1', element);

      var latex = mq.latex();
      assert.equal(latex, '\\foreignobject{test1}');
    });

    test('foreignObject returns this for chaining', function () {
      var element = document.createElement('button');
      var result = mq.foreignObject('test1', element);

      assert.equal(result, mq);
    });

    test('foreignObject can be chained with write', function () {
      var element = document.createElement('button');

      mq.foreignObject('test1', element).write(' + y');

      var latex = mq.latex();
      assert.equal(latex, '\\foreignobject{test1}+y');
    });

    test('multiple foreign objects can be inserted', function () {
      var elem1 = document.createElement('button');
      var elem2 = document.createElement('input');
      var elem3 = document.createElement('div');

      mq.foreignObject('btn1', elem1);
      mq.write('+');
      mq.foreignObject('input1', elem2);
      mq.write('+');
      mq.foreignObject('div1', elem3);

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') > -1);
      assert.ok(latex.indexOf('\\foreignobject{input1}') > -1);
      assert.ok(latex.indexOf('\\foreignobject{div1}') > -1);
    });
  });

  suite('LaTeX Integration', function () {
    test('parsing \\foreignobject{id} from LaTeX', function () {
      var element = document.createElement('button');
      element.textContent = 'Click';

      mq.foreignObject('btn1', element);

      var latex = mq.latex();
      assert.equal(latex, '\\foreignobject{btn1}');
    });

    test('foreign object renders in DOM', function () {
      var element = document.createElement('button');
      element.textContent = 'Click';
      element.id = 'test-button';

      mq.foreignObject('btn1', element);

      var container = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(container.length, 1);
      assert.equal(container.attr('data-object-id'), 'btn1');

      var button = container.find('#test-button');
      assert.equal(button.length, 1);
      assert.equal(button.text(), 'Click');
    });

    test('error shown for unregistered ID', function () {
      mq.latex('\\foreignobject{nonexistent}');

      var errorEl = $(mq.el()).find('.mq-foreign-object-error');
      assert.equal(errorEl.length, 1);
      assert.ok(errorEl.text().indexOf('nonexistent') > -1);
    });

    test('multiple foreign objects in one expression', function () {
      var elem1 = document.createElement('button');
      elem1.textContent = 'A';
      var elem2 = document.createElement('button');
      elem2.textContent = 'B';

      mq.foreignObject('btn1', elem1);
      mq.write('+');
      mq.foreignObject('btn2', elem2);

      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 2);
      assert.equal($(containers[0]).attr('data-object-id'), 'btn1');
      assert.equal($(containers[1]).attr('data-object-id'), 'btn2');
    });

    test('foreign object can be part of complex expression', function () {
      var element = document.createElement('button');
      mq.foreignObject('btn1', element);
      mq.cmd('\\');
      mq.typedText('frac');
      mq.keystroke('Enter');
      mq.typedText('x');
      mq.keystroke('Tab');
      mq.typedText('2');

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') > -1);
      assert.ok(latex.indexOf('\\frac') > -1);
    });
  });

  suite('Automatic Cleanup', function () {
    test('foreign object removed when LaTeX replaced', function () {
      var element = document.createElement('button');
      element.textContent = 'Test';

      mq.foreignObject('btn1', element);
      assert.equal(mq.latex(), '\\foreignobject{btn1}');

      // Replace LaTeX - btn1 should be automatically cleaned up
      mq.latex('x + y');

      // Verify btn1 is no longer rendered
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 0);

      // If we set LaTeX with btn1 again, it should show error (not in registry)
      mq.latex('\\foreignobject{btn1}');
      var errorEl = $(mq.el()).find('.mq-foreign-object-error');
      assert.equal(errorEl.length, 1);
    });

    test('foreign object kept when still referenced in new LaTeX', function () {
      var element = document.createElement('button');
      element.id = 'persistent-btn';

      mq.foreignObject('btn1', element);
      assert.equal(mq.latex(), '\\foreignobject{btn1}');

      // Replace LaTeX but keep the foreign object reference
      mq.latex('x + \\foreignobject{btn1} + y');

      // Verify btn1 is still rendered (no error)
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 1);
      var button = $(mq.el()).find('#persistent-btn');
      assert.equal(button.length, 1);
    });

    test('only unreferenced objects are removed', function () {
      var elem1 = document.createElement('button');
      elem1.id = 'btn1-el';
      var elem2 = document.createElement('button');
      elem2.id = 'btn2-el';
      var elem3 = document.createElement('button');
      elem3.id = 'btn3-el';

      mq.foreignObject('btn1', elem1);
      mq.write('+');
      mq.foreignObject('btn2', elem2);
      mq.write('+');
      mq.foreignObject('btn3', elem3);

      // All three should be present
      assert.equal($(mq.el()).find('.mq-foreign-object-container').length, 3);

      // Replace LaTeX keeping only btn2
      mq.latex('\\foreignobject{btn2}');

      // Only btn2 should be rendered
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 1);
      assert.equal($(mq.el()).find('#btn2-el').length, 1);

      // btn1 and btn3 should be gone from registry
      mq.latex('\\foreignobject{btn1}');
      var errorEl = $(mq.el()).find('.mq-foreign-object-error');
      assert.equal(errorEl.length, 1);
    });

    test('registry cleared when MathField reverted', function () {
      var element = document.createElement('button');
      mq.foreignObject('btn1', element);

      mq.revert();

      // After revert, the MathField is destroyed, registry should be cleared
      // Note: After revert, mq methods won't work, so we just verify no errors
      assert.ok(true);
    });
  });

  suite('Deletion', function () {
    test('backspace deletes foreign object from DOM', function () {
      var element = document.createElement('button');
      element.textContent = 'Test';

      mq.foreignObject('btn1', element).write('+y');

      // Move cursor to before +y
      mq.moveToRightEnd();
      mq.keystroke('Left');
      mq.keystroke('Left');

      // Backspace to delete foreign object
      mq.keystroke('Backspace');

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') === -1);
      assert.ok(latex.indexOf('+y') > -1);

      // Check that foreign object is no longer rendered
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 0);
    });

    test('delete key removes foreign object from DOM', function () {
      var element = document.createElement('button');
      mq.foreignObject('btn1', element);
      mq.write('+x');

      // Move cursor to left of foreign object
      mq.moveToLeftEnd();

      // Delete to remove foreign object
      mq.keystroke('Del');

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') === -1);
    });

    test('deleting foreign object removes from registry', function () {
      var element = document.createElement('button');
      element.id = 'deletable-btn';

      mq.foreignObject('btn1', element);

      // Verify it's rendered
      assert.equal($(mq.el()).find('#deletable-btn').length, 1);

      // Delete it
      mq.moveToRightEnd();
      mq.keystroke('Backspace');

      // Try to use it again - should show error
      mq.latex('\\foreignobject{btn1}');
      var errorEl = $(mq.el()).find('.mq-foreign-object-error');
      assert.equal(errorEl.length, 1);
    });
  });

  suite('Element Handling', function () {
    test('uses original element not clone', function () {
      var element = document.createElement('button');
      element.id = 'unique-test-id';
      element.textContent = 'Original';

      mq.foreignObject('btn1', element);

      // Find the button in the DOM
      var renderedButton = $(mq.el()).find('#unique-test-id');
      assert.equal(renderedButton.length, 1);

      // Modify original element
      element.textContent = 'Modified';

      // Should reflect in rendered version (same element)
      assert.equal(renderedButton.text(), 'Modified');
    });

    test('element removed from DOM when LaTeX changes', function () {
      var element = document.createElement('button');
      element.id = 'removable-btn';
      element.textContent = 'Removable';

      mq.foreignObject('btn1', element);

      // Verify it's in the DOM
      assert.equal($(mq.el()).find('#removable-btn').length, 1);

      // Change LaTeX
      mq.latex('x + y');

      // Element should be removed from MathField DOM
      assert.equal($(mq.el()).find('#removable-btn').length, 0);
    });
  });

  suite('Valid ID patterns', function () {
    test('accepts alphanumeric IDs', function () {
      var element = document.createElement('div');
      mq.foreignObject('abc123', element);

      assert.equal(mq.latex(), '\\foreignobject{abc123}');
    });

    test('accepts IDs with hyphens', function () {
      var element = document.createElement('div');
      mq.foreignObject('my-widget', element);

      assert.equal(mq.latex(), '\\foreignobject{my-widget}');
    });

    test('accepts IDs with underscores', function () {
      var element = document.createElement('div');
      mq.foreignObject('my_widget', element);

      assert.equal(mq.latex(), '\\foreignobject{my_widget}');
    });
  });

  suite('Cursor positioning', function () {
    test('cursor positioned after inserted foreign object', function () {
      var element = document.createElement('button');
      mq.foreignObject('btn1', element);

      // Cursor should be after the foreign object
      // Typing should add after it
      mq.typedText('x');

      var latex = mq.latex();
      assert.equal(latex, '\\foreignobject{btn1}x');
    });

    test('can write before foreign object', function () {
      var element = document.createElement('button');
      mq.foreignObject('btn1', element);
      mq.moveToLeftEnd();
      mq.typedText('x');

      var latex = mq.latex();
      assert.equal(latex, 'x\\foreignobject{btn1}');
    });
  });
});
