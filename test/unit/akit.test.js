suite('akit', function () {
  const $ = window.test_only_jquery;
  var mq, mostRecentlyReportedLatex;

  setup(function () {
    mostRecentlyReportedLatex = NaN;
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
      autoCommands: 'pi',
      handlers: {
        edit: function () {
          mostRecentlyReportedLatex = mq.latex();
        },
      },
    });
  });

  test('cases parse correctly', function () {
    var casesLatex = '\\begin{cases}1\\\\2\\end{cases}';
    mq.latex(casesLatex);
    assert.equal(mostRecentlyReportedLatex, casesLatex);
    assert.equal(mq.latex(), casesLatex);

    mq.latex('');
  });

  test("writing pi doesn't trigger autocommand", function () {
    mq.typedText('pi');
    assert.equal(mostRecentlyReportedLatex, 'pi');
    assert.equal(mq.latex(), 'pi');
    mq.typedText(' ');
    assert.equal(mostRecentlyReportedLatex, '\\pi');
    assert.equal(mq.latex(), '\\pi');

    mq.latex('');
  });

  test('angle brackets match with square brackets', function () {
    mq.typedText('\\langle]');
    assert.equal(mostRecentlyReportedLatex, '\\left\\langle\\right]');
    assert.equal(mq.latex(), '\\left\\langle\\right]');
    mq.latex('');

    mq.typedText('[\\rangle ');
    assert.equal(mostRecentlyReportedLatex, '\\left[\\right\\rangle\\ ');
    assert.equal(mq.latex(), '\\left[\\right\\rangle\\ ');

    mq.latex('');
  });

  test('ContainerHasFocus pierces Shadow DOM', function () {
    const shadowDiv = document.createElement('div');
    const shadowRoot = shadowDiv.attachShadow({ mode: 'open' });

    const mqSpan = document.createElement('span');
    mq = MQ.MathField(mqSpan, {
      autoCommands: 'pi',
      handlers: {
        edit: function () {
          mostRecentlyReportedLatex = mq.latex();
        },
      },
    });

    shadowRoot.appendChild(mqSpan);
    document.getElementById('mock').appendChild(shadowDiv);

    mq.focus();
    assert.equal(mq.__controller.containerHasFocus(), true);
  });
});
