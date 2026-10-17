module.exports = {
  'env': {
    'browser': true,
    'es2021': true,
  },
  'extends': 'eslint:recommended',
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
  },
  'rules': {
    'brace-style': [
      'error',
      '1tbs',
    ],
    'indent': [
      'error',
      2,
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    'no-undef': 'off',
    'no-unused-vars': [
      'error',
      {
        // A handful of onPowerUse/onPerkUse-dispatched functions keep an unused leading `actor`
        // (or similarly-named) parameter purely so every handler shares one call signature - see
        // e.g. helpers/monster-grow.mjs#activateMonsterGrow's own doc comment. Prefix with `_` to
        // mark those as deliberate, not oversights.
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    // 'quotes': [
    //     'error',
    //     'single'
    // ],
    'semi': [
      'error',
      'always',
    ],
    'padding-line-between-statements': [
      'error',
      {
        // Always require a line after a { ... } statement
        blankLine: 'always',
        prev: ['block-like'],
        next: ['*'],
      },
    ],
    'comma-dangle': [
      'error',
      'always-multiline',
    ],
    'eol-last': [
      'error',
      'always',
    ],
  },
};
