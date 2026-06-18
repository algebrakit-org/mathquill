suite('autoOperatorNames', function () {
  const $ = window.test_only_jquery;
  var mq;
  var normalConfig = {
    autoCommands: 'sum int',
  };
  var subscriptConfig = {
    autoCommands: 'sum int',
    disableAutoSubstitutionInSubscripts: true,
  };

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    mq.config(normalConfig);
  });

  function assertLatex(input, expected) {
    var result = mq.latex();
    assert.equal(
      result,
      expected,
      input + ", got '" + result + "', expected '" + expected + "'"
    );
  }

  function assertText(input, expected) {
    var result = mq.text();
    assert.equal(
      result,
      expected,
      input + ", got '" + result + "', expected '" + expected + "'"
    );
  }

  // Count the atomic operator-name symbols currently in the field.
  function operatorCount() {
    return $(mq.el()).find('.mq-operator-name').length;
  }

  test('LaTeX parsing produces a single atomic operator symbol', function () {
    // Built-in operators round-trip as \name; nonstandard ones as
    // \operatorname{name}. Either way they parse to exactly one atomic symbol.
    function assertParses(latex) {
      mq.latex(latex);
      assertLatex("parsing '" + latex + "'", latex);
      assert.equal(operatorCount(), 1, 'one operator-name element');
    }

    assertParses('\\sin');
    assertParses('\\inf');
    assertParses('\\operatorname{arcosh}');
    // \operatorname{...} of a built-in normalizes to the \name form.
    mq.latex('\\operatorname{sin}');
    assertLatex('\\operatorname{sin} normalizes', '\\sin');
  });

  test('typing letters then a trigger converts to one atomic symbol', function () {
    // Like the autoCommand `pi`, conversion happens on the first non-letter
    // keystroke and consumes the whole contiguous run of letters.
    mq.typedText('sin');
    assertLatex('no trigger yet, still letters', 'sin');
    assert.equal(operatorCount(), 0);

    mq.typedText(' ');
    assertLatex("'sin' + space converts", '\\sin');
    assert.equal(operatorCount(), 1);
  });

  test('whole-run only: a run that is not an operator name is left alone', function () {
    // Matches the AlgebraKit behavior: we never match substrings, so a longer
    // word that merely contains an operator name is not converted.
    mq.typedText('acosh');
    mq.typedText(' ');
    assertLatex("'acosh' is not an operator name", 'acosh');
    assert.equal(operatorCount(), 0);

    mq.latex('');
    mq.typedText('xsin');
    mq.typedText(' ');
    assertLatex("'xsin' is not an operator name", 'xsin');
    assert.equal(operatorCount(), 0);
  });

  test('operator is deleted atomically with a single backspace', function () {
    mq.typedText('sin ');
    assertLatex("'sin' converted", '\\sin');
    assert.equal(operatorCount(), 1);

    mq.keystroke('Backspace');
    assertLatex('whole operator deleted by one backspace', '');
    assert.equal(operatorCount(), 0);
  });

  test('works in \\sum', function () {
    mq.typedText('sum');
    mq.typedText('sin ');
    assertLatex('sum allows operatorname', '\\sum_{\\sin}^{ }');
  });

  test('works in \\int', function () {
    mq.typedText('int');
    mq.typedText('sin ');
    assertLatex('int allows operatorname', '\\int_{\\sin}^{ }');
  });

  test('no auto operator names in simple subscripts when typing', function () {
    mq.config(normalConfig);
    mq.typedText('x_');
    mq.typedText('sin ');
    assertLatex('subscripts turn to operatorname', 'x_{\\sin}');
    mq.latex('');
    mq.config(subscriptConfig);
    mq.typedText('x_');
    mq.typedText('sin ');
    assertLatex('subscripts do not turn to operatorname', 'x_{sin}');
    mq.config(normalConfig);
  });

  test('pasting bare letters does not auto-convert to an operator', function () {
    // Auto-conversion only happens on a trigger key while typing; pasted latex
    // is taken literally, so bare letters stay letters (regardless of the
    // subscript-substitution config).
    var textarea = $(mq.el()).find('textarea');
    mq.config(normalConfig);
    trigger.paste(textarea[0]);
    textarea.val('x_{sin}');
    trigger.input(textarea[0]);
    assertLatex('pasted bare letters stay letters', 'x_{sin}');

    mq.latex('');
    // Pasting an explicit \operatorname{...}, however, parses to the symbol.
    trigger.paste(textarea[0]);
    textarea.val('x_{\\sin}');
    trigger.input(textarea[0]);
    assertLatex('pasted \\sin parses to operator', 'x_{\\sin}');
  });

  test('text() output', function () {
    function assertTranslatedCorrectly(latexStr, text) {
      mq.latex(latexStr);
      assertText('outputting ' + latexStr, text);
    }

    assertTranslatedCorrectly('\\sin', 'sin');
    assertTranslatedCorrectly('\\sin\\left(xy\\right)', 'sin(x*y)');
  });

  suite('override autoOperatorNames', function () {
    test('basic', function () {
      mq.config({ autoOperatorNames: 'sin lol' });
      // Only whole contiguous runs convert, and only on a trigger key.
      mq.typedText('sin ');
      assert.equal(mq.latex(), '\\sin');

      mq.latex('');
      mq.typedText('lol ');
      assert.equal(mq.latex(), '\\operatorname{lol}');

      mq.latex('');
      // 'arcsin' is not in the overridden list, so it stays as letters.
      mq.typedText('arcsin ');
      assert.equal(mq.latex(), 'arcsin');
    });

    test('command contains non-letters', function () {
      assert.throws(function () {
        MQ.config({ autoOperatorNames: 'e1' });
      });
    });

    test('command length less than 2', function () {
      assert.throws(function () {
        MQ.config({ autoOperatorNames: 'e' });
      });
    });

    suite('command list not perfectly space-delimited', function () {
      test('double space', function () {
        assert.throws(function () {
          MQ.config({ autoOperatorNames: 'pi  theta' });
        });
      });

      test('leading space', function () {
        assert.throws(function () {
          MQ.config({ autoOperatorNames: ' pi' });
        });
      });

      test('trailing space', function () {
        assert.throws(function () {
          MQ.config({ autoOperatorNames: 'pi ' });
        });
      });
    });
  });
});
