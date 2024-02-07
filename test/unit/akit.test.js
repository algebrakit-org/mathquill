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
});
