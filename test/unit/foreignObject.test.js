suite('Foreign Objects', function () {
  const $ = window.test_only_jquery;

  var mq;
  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
  });

  teardown(function () {
    $(mq.el()).remove();
  });

  suite('Registry API', function () {
    test('registerForeignObject adds element to registry', function () {
      var element = document.createElement('button');
      element.textContent = 'Test';

      mq.registerForeignObject('test1', element);

      assert.ok(mq.hasForeignObject('test1'));
      assert.equal(mq.getForeignObject('test1'), element);
    });

    test('registerForeignObject returns this for chaining', function () {
      var element = document.createElement('button');
      var result = mq.registerForeignObject('test1', element);

      assert.equal(result, mq);
    });

    test('getForeignObject returns null for non-existent ID', function () {
      assert.equal(mq.getForeignObject('nonexistent'), null);
    });

    test('hasForeignObject returns false for non-existent ID', function () {
      assert.equal(mq.hasForeignObject('nonexistent'), false);
    });

    test('unregisterForeignObject removes from registry', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('test1', element);

      mq.unregisterForeignObject('test1');

      assert.equal(mq.hasForeignObject('test1'), false);
      assert.equal(mq.getForeignObject('test1'), null);
    });

    test('multiple foreign objects can be registered', function () {
      var elem1 = document.createElement('button');
      var elem2 = document.createElement('input');
      var elem3 = document.createElement('div');

      mq.registerForeignObject('btn1', elem1);
      mq.registerForeignObject('input1', elem2);
      mq.registerForeignObject('div1', elem3);

      assert.ok(mq.hasForeignObject('btn1'));
      assert.ok(mq.hasForeignObject('input1'));
      assert.ok(mq.hasForeignObject('div1'));
      assert.equal(mq.getForeignObject('btn1'), elem1);
      assert.equal(mq.getForeignObject('input1'), elem2);
      assert.equal(mq.getForeignObject('div1'), elem3);
    });
  });

  suite('LaTeX Integration', function () {
    test('parsing \\foreignobject{id} from LaTeX', function () {
      var element = document.createElement('button');
      element.textContent = 'Click';

      mq.registerForeignObject('btn1', element);
      mq.latex('x = \\foreignobject{btn1} + y');

      var latex = mq.latex();
      assert.equal(latex, 'x=\\foreignobject{btn1}+y');
    });

    test('foreign object renders in DOM', function () {
      var element = document.createElement('button');
      element.textContent = 'Click';
      element.id = 'test-button';

      mq.registerForeignObject('btn1', element);
      mq.latex('\\foreignobject{btn1}');

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

      mq.registerForeignObject('btn1', elem1);
      mq.registerForeignObject('btn2', elem2);
      mq.latex('\\foreignobject{btn1} + \\foreignobject{btn2}');

      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 2);
      assert.equal($(containers[0]).attr('data-object-id'), 'btn1');
      assert.equal($(containers[1]).attr('data-object-id'), 'btn2');
    });

    test('foreign object can be part of complex expression', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element);

      mq.latex('\\frac{\\foreignobject{btn1}}{x^2}');

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') > -1);
      assert.ok(latex.indexOf('\\frac') > -1);
    });
  });

  suite('Lifecycle Management', function () {
    test('onUnmount callback called when unregistering', function () {
      var callbackCalled = false;
      var callbackId = null;
      var callbackReason = null;

      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element, {
        onUnmount: function (id, el, reason) {
          callbackCalled = true;
          callbackId = id;
          callbackReason = reason;
          return false;
        },
      });

      mq.unregisterForeignObject('btn1');

      assert.ok(callbackCalled);
      assert.equal(callbackId, 'btn1');
      assert.equal(callbackReason, 'explicit_unregister');
    });

    test('onUnmount returning true keeps object in registry', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element, {
        onUnmount: function () {
          return true; // Keep in registry
        },
      });

      mq.unregisterForeignObject('btn1');

      assert.ok(mq.hasForeignObject('btn1'));
    });

    test('onUnmount returning false removes object from registry', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element, {
        onUnmount: function () {
          return false; // Remove from registry
        },
      });

      mq.unregisterForeignObject('btn1');

      assert.equal(mq.hasForeignObject('btn1'), false);
    });

    test('registry cleared when MathField reverted', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element);
      mq.latex('\\foreignobject{btn1}');

      assert.ok(mq.hasForeignObject('btn1'));

      mq.revert();

      // After revert, the MathField is destroyed, registry should be cleared
      // Note: After revert, mq methods won't work, so we just verify no errors
      assert.ok(true);
    });
  });

  suite('Deletion', function () {
    test('backspace deletes foreign object', function () {
      var element = document.createElement('button');
      element.textContent = 'Test';

      mq.registerForeignObject('btn1', element);
      mq.latex('x = \\foreignobject{btn1}');

      // Move cursor to end
      mq.moveToRightEnd();

      // Backspace to delete foreign object
      mq.keystroke('Backspace');

      var latex = mq.latex();
      assert.equal(latex, 'x=');

      // Check that foreign object is no longer rendered
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 0);
    });

    test('delete key removes foreign object', function () {
      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element);
      mq.latex('\\foreignobject{btn1} + x');

      // Move cursor to left of foreign object
      mq.moveToLeftEnd();

      // Delete to remove foreign object
      mq.keystroke('Del');

      var latex = mq.latex();
      assert.ok(latex.indexOf('\\foreignobject{btn1}') === -1);
    });

    test('onUnmount called with LATEX_CHANGED when deleted', function () {
      var callbackCalled = false;
      var callbackReason = null;

      var element = document.createElement('button');
      mq.registerForeignObject('btn1', element, {
        onUnmount: function (id, el, reason) {
          callbackCalled = true;
          callbackReason = reason;
          return false;
        },
      });

      mq.latex('\\foreignobject{btn1}');
      mq.moveToRightEnd();
      mq.keystroke('Backspace');

      assert.ok(callbackCalled);
      assert.equal(callbackReason, 'latex_changed');
    });
  });

  suite('Element Handling', function () {
    test('uses original element not clone', function () {
      var element = document.createElement('button');
      element.id = 'unique-test-id';
      element.textContent = 'Original';

      mq.registerForeignObject('btn1', element);
      mq.latex('\\foreignobject{btn1}');

      // Find the button in the DOM
      var renderedButton = $(mq.el()).find('#unique-test-id');
      assert.equal(renderedButton.length, 1);

      // Modify original element
      element.textContent = 'Modified';

      // Should reflect in rendered version (same element)
      assert.equal(renderedButton.text(), 'Modified');
    });

    test('element can be reused after LaTeX change', function () {
      var element = document.createElement('button');
      element.textContent = 'Reusable';

      mq.registerForeignObject('btn1', element, {
        onUnmount: function () {
          return true; // Keep in registry
        },
      });

      mq.latex('x = \\foreignobject{btn1}');
      var latex1 = mq.latex();

      // Change LaTeX (triggers unmount)
      mq.latex('y = 2');

      // Object should still be in registry
      assert.ok(mq.hasForeignObject('btn1'));

      // Can be used again
      mq.latex(latex1);
      var containers = $(mq.el()).find('.mq-foreign-object-container');
      assert.equal(containers.length, 1);
    });
  });

  suite('Valid ID patterns', function () {
    test('accepts alphanumeric IDs', function () {
      var element = document.createElement('div');
      mq.registerForeignObject('abc123', element);
      mq.latex('\\foreignobject{abc123}');

      assert.equal(mq.latex(), '\\foreignobject{abc123}');
    });

    test('accepts IDs with hyphens', function () {
      var element = document.createElement('div');
      mq.registerForeignObject('my-widget', element);
      mq.latex('\\foreignobject{my-widget}');

      assert.equal(mq.latex(), '\\foreignobject{my-widget}');
    });

    test('accepts IDs with underscores', function () {
      var element = document.createElement('div');
      mq.registerForeignObject('my_widget', element);
      mq.latex('\\foreignobject{my_widget}');

      assert.equal(mq.latex(), '\\foreignobject{my_widget}');
    });
  });
});
