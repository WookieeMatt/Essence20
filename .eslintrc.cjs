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
      { "SwitchCase": 1 },
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    'no-undef': 'off',
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
  },
};
