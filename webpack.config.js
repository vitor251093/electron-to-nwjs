
// NW.js 0.14.7 includes Chromium 50.0.2661.102 and Node.js 5.11.1
// https://nodejs.org/dist/latest-v5.x/docs/api/

const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const child_process = require('child_process')

module.exports = (env, argv) => {
    const projectPath = path.resolve(__dirname, '.', 'www')
    const projectPackagePath = path.resolve(projectPath, 'package.json')
    const projectPackageStr = fs.readFileSync(projectPackagePath, {encoding: 'utf-8'})
    const projectPackageJson = JSON.parse(projectPackageStr)

    const jsFiles = []
    var fakeLibsFolder = path.resolve(__dirname, "fakelibs")
    if (env.main === true) {
        const mainFile = (projectPackageJson.nwjs || {}).main || projectPackageJson.main;
        jsFiles.push(mainFile)
    }
    else if ((projectPackageJson.nwjs || {}).jsFiles !== undefined) {
        jsFiles.push(...(projectPackageJson.nwjs || {}).jsFiles)
    }
    else {
        const listHtmlsStr = child_process.execSync('find . -type f -name "*.html"', {cwd: projectPath, encoding: 'utf8'})
        const listHtmls = listHtmlsStr.split("\n").filter(line => line.trim().length > 0 && !line.startsWith("./node_modules/"))
        listHtmls.forEach(htmlPath => {
            const indexHtmlContents = fs.readFileSync(path.join(projectPath, htmlPath), {encoding: 'utf-8'})
            const $ = cheerio.load(indexHtmlContents);
            const scripts = $('script[src]')
            jsFiles.push(...scripts.map(function() { return $(this).attr('src'); }).get())
        })
    }

    const aliases = {}
    const dependenciesThatShouldBeFaked = fs.readdirSync(fakeLibsFolder)
    dependenciesThatShouldBeFaked.forEach(dep => aliases[dep] = path.join(fakeLibsFolder, dep))

    const jsFileByOutputFile = {}
    if (env.main === true) {
        jsFileByOutputFile[jsFiles[0]] = [
            path.resolve(__dirname, './www', jsFiles[0]),
            path.resolve(__dirname, './fakelibs', 'post-main.js')
        ]
    }
    else {
        // TODO: That may be needed later
        //files.unshift('babel-polyfill');
        jsFiles.forEach(jsFile => {
            jsFileByOutputFile[jsFile] = [path.resolve(__dirname, './www', jsFile)]
        })
    }

    return {
        target: ['nwjs', 'node5'],
        entry: jsFileByOutputFile,
        mode: "production",
        output: {
            path: path.resolve(__dirname, "./_www"),
            filename: '[name].js'
        },
        resolve: {
            alias: aliases
        },
        experiments: {
            topLevelAwait: true
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    loader: 'string-replace-loader',
                    options: {
                        search: '__dirname',
                        replace: env.prod ? "(require('path').dirname(process.execPath))" : "(process.cwd())",
                        flags: 'g'
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'string-replace-loader',
                    options: {
                        search: '__nwjs_app_version',
                        replace: JSON.stringify(projectPackageJson.version),
                        flags: 'g'
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'string-replace-loader',
                    options: {
                        search: '__nwjs_app_name',
                        replace: JSON.stringify((projectPackageJson.build || {}).productName || projectPackageJson.name),
                        flags: 'g'
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'string-replace-loader',
                    options: {
                        search: '__nwjs_is_packaged',
                        replace: env.prod ? "true" : "false",
                        flags: 'g'
                    }
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            sourceType: "script",
                            presets: [['@babel/preset-env', {useBuiltIns: 'usage', corejs:'2'}]],
                            plugins: ["@babel/plugin-transform-async-to-generator"]
                        }
                    }
                }
            ]
        },
        optimization: {
            minimize: false
        }
    }
};
