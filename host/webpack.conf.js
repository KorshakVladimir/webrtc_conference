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
    watch: true
};