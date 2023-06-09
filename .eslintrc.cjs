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
    // 'quotes': [
    //     'error',
    //     'single'
    // ],
    'semi': [
      'error',
      'always',
    ],
  },
};
