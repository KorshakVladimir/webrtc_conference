const path = require('path');
module.exports = {
    mode: "production",
    entry: "./src/main",
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.bundle.js'
    }
    ,
    devtool: "source-map", // enum
    devServer: {
      contentBase: path.join(__dirname, "dist"),
      compress: true,
      port: 9000,
      https: true
    },
    optimization: {
		// We no not want to minimize our code.
      minimize: false
    },
};