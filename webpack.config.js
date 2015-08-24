module.exports = {
    entry: './src/rxwebrtc.js',
    devtool: "source-map",
    output: {
    filename: 'rxwebrtc.js',
        path: __dirname + '/build'
    },
    module: {
         loaders: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel-loader',
                query: {
                    cacheDirectory: true
                }
            }
        ]
    },
     externals: {
        'rx': 'Rx'
    }
}