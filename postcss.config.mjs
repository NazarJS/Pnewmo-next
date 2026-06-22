const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-pxtorem": {         
      rootValue: 16,
      unitPrecision: 5,
      propList: ["*"],
      selectorBlackList: [],
      replace: true,
      mediaQuery: false,
      minPixelValue: 2,
    },
  },
};

export default config;
