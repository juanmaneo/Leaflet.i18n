#!/usr/bin/env node

var argv = require('optimist')
           .usage('node i18n.js --dir_path={somepath} --locale_dir_path={somepath} --locale_codes={nl,fr,es} --mode={js|json}')
           .demand(['dir_path','locale_dir_path', 'locale_codes', 'mode'])
           .default('mode', 'js')
           .argv;
var UglifyJS = require("uglify-js");
var fs = require("fs");
var path = require("path");
var dir_path = argv.dir_path,
    locale_dir = argv.locale_dir_path,
    locale_codes = argv.locale_codes.split(','),
    mode = argv.mode,
    files = fs.readdirSync(dir_path),
    ast = null,
    code = "",
    strings = [];
files.forEach(function(file){
    code += fs.readFileSync(path.join(dir_path, file), "utf8");
});
ast = UglifyJS.parse(code);

ast.walk(new UglifyJS.TreeWalker(function (node) {
    if (node instanceof UglifyJS.AST_Call && node.expression.property == "_") {
        if (typeof node.args[0].value !== "undefined") {
            strings.push(node.args[0].value);
        }
    }
}));
strings.sort();

var toJS = function (locale_code, locale_path) {
    /* Needed to eval the locale files */
    L = {
        registerLocale: function (name, strings) {
            translations = strings;
        }
    };
    var translations = {},
        raw_content = "var " + locale_code + " = ";
    if (fs.existsSync(locale_path)) {
        // Will call our monkeypatched registerLocale
        eval(fs.readFileSync(locale_path, "utf8"));
    }
    strings.forEach(function (str) {
        if (!translations[str]) {
            translations[str] = "";
        }
    });
    raw_content += JSON.stringify(translations, null, 4);
    raw_content += ";\n\n";
    raw_content += 'L.registerLocale("' + locale_code + '", '+ locale_code + ');';
    return raw_content;
};

var toJSON = function (locale_code, locale_path) {
    var translations = {};
    if (fs.existsSync(locale_path)) {
        translations = JSON.parse(fs.readFileSync(locale_path, "utf8"));
    }
    strings.forEach(function (str) {
        if (!translations[str]) {
            translations[str] = "";
        }
    });
    return JSON.stringify(translations, null, 4);
};
locale_codes.forEach(function (locale_code) {
    var locale_path = path.join(locale_dir, locale_code + "." + mode);
    var func = (mode === "json")? toJSON: toJS;
    var raw_content = func(locale_code, locale_path);
    process.stdout.write('Writing file for locale "' + locale_code + '"\n');
    fs.writeFileSync(locale_path, raw_content, 'utf8');
});
