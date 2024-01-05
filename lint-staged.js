module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --quiet --fix', 'eslint --max-warnings=0'],
  '*.{json,js,ts,jsx,tsx,html}': ['prettier --write --ignore-unknown'],
};
