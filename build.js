var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="type_declarations/DefinitelyTyped/node/node.d.ts" />
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var tsc_filepath = path.join(__dirname, 'node_modules/.bin/tsc');
function generateTypeDeclaration(name, config) {
    var root = new TypeScriptRootModule(name);
    buildSourceTree(config, root);
    // move references and external imports to the root module; strip relative imports
    root.children.forEach(function (source) { return percolateSourceTree(source, root); });
    fs.writeFileSync('index.ts', root.toLines().join('\n'), { encoding: 'utf8' });
    child_process.execFile(tsc_filepath, ['-m', 'commonjs', '-t', 'ES5', '-d', 'index.ts'], function (error, stdout, stderr) {
        if (error) {
            console.log(stdout);
            console.error(stderr);
            process.exit(1);
        }
        console.error('compiled index.js');
        var index_d_ts = fs.readFileSync('index.d.ts', { encoding: 'utf8' });
        var name_d_ts = index_d_ts
            .replace("declare module " + name, "declare module \"" + name + "\"")
            .replace("export = " + name + ";\n", '');
        // finally, write the main type declarations
        fs.writeFileSync(name + ".d.ts", name_d_ts, { encoding: 'utf8' });
        console.error("wrote " + name + ".d.ts");
        // clean up
        // we've built index.d.ts and index.js, so we don't need index.ts
        fs.unlinkSync('index.ts');
        // and we've effectively moved index.d.ts to <name>.d.ts, with some changes,
        // so we can delete the original index.d.ts
        fs.unlinkSync('index.d.ts');
    });
}
exports.generateTypeDeclaration = generateTypeDeclaration;
function pushAll(array, items) {
    return Array.prototype.push.apply(array, items);
}
function flatten(arrays) {
    return Array.prototype.concat.apply([], arrays);
}
function indent(lines, prefix) {
    if (prefix === void 0) { prefix = '  '; }
    return lines.map(function (line) { return '  ' + line; });
}
function buildSourceTree(config, parent) {
    for (var module_name in config) {
        // create module container
        var source_module = new TypeScriptSourceModule(module_name);
        // add it to the provided parent
        parent.children.push(source_module);
        // recurse on object values, terminate on string values
        var module_value = config[module_name];
        if (typeof module_value === 'string') {
            var filename = module_value + '.ts';
            var source = readSourceCodeSync(filename);
            source_module.children.push(source);
        }
        else {
            buildSourceTree(module_value, source_module);
        }
    }
}
function percolateSourceTree(source, root) {
    // filter out relative imports
    var requirements = source.requirements.filter(function (requirement) { return requirement.path[0] !== '.'; });
    // move remaining (external) imports to the root module
    pushAll(root.requirements, requirements);
    source.requirements = [];
    // move references to the root module
    pushAll(root.references, source.references);
    source.references = [];
    // recurse
    if (source instanceof TypeScriptSourceModule) {
        source.children.forEach(function (source) { return percolateSourceTree(source, root); });
    }
}
var referenceRegExp = /^\/\/\/\s*<reference\s*path=(['"])([^\1]+)\1\s*\/>\s*$/;
var requirementRegExp = /^(var|import)\s*(\w+)\s*=\s*require\((['"])([^\3]+)\3\);$/;
function readSourceCodeSync(filename) {
    var source = new TypeScriptSourceCode();
    fs.readFileSync(filename, { encoding: 'utf8' }).split(/\n/).forEach(function (line) {
        var match;
        if (match = line.match(referenceRegExp)) {
            source.references.push(match[2]);
        }
        else if (match = line.match(requirementRegExp)) {
            source.requirements.push({ type: match[1], name: match[2], path: match[4] });
        }
        else {
            source.lines.push(line);
        }
    });
    return source;
}
/**
references: an array of the reference paths
*/
var TypeScriptSource = (function () {
    function TypeScriptSource(references, requirements) {
        if (references === void 0) { references = []; }
        if (requirements === void 0) { requirements = []; }
        this.references = references;
        this.requirements = requirements;
    }
    TypeScriptSource.prototype.toLines = function () {
        return flatten([
            this.references.map(function (reference) { return ("/// <reference path=\"" + reference + "\" />"); }),
            this.requirements.map(function (requirement) { return (requirement.type + " " + requirement.name + " = require('" + requirement.path + "');"); }),
        ]);
    };
    return TypeScriptSource;
})();
var TypeScriptSourceCode = (function (_super) {
    __extends(TypeScriptSourceCode, _super);
    function TypeScriptSourceCode(lines) {
        if (lines === void 0) { lines = []; }
        _super.call(this);
        this.lines = lines;
    }
    TypeScriptSourceCode.prototype.toLines = function () {
        return flatten([
            _super.prototype.toLines.call(this),
            this.lines,
        ]);
    };
    return TypeScriptSourceCode;
})(TypeScriptSource);
var TypeScriptSourceModule = (function (_super) {
    __extends(TypeScriptSourceModule, _super);
    function TypeScriptSourceModule(name, children) {
        if (children === void 0) { children = []; }
        _super.call(this);
        this.name = name;
        this.children = children;
    }
    TypeScriptSourceModule.prototype.toLines = function () {
        return flatten([
            _super.prototype.toLines.call(this),
            [("export module " + this.name + " {")],
            indent(flatten(this.children.map(function (child) { return child.toLines(); }))),
            ["}"],
        ]);
    };
    return TypeScriptSourceModule;
})(TypeScriptSource);
var TypeScriptRootModule = (function (_super) {
    __extends(TypeScriptRootModule, _super);
    function TypeScriptRootModule(name, children) {
        if (children === void 0) { children = []; }
        _super.call(this);
        this.name = name;
        this.children = children;
    }
    TypeScriptRootModule.prototype.toLines = function () {
        return flatten([
            _super.prototype.toLines.call(this),
            [("module " + this.name + " {")],
            indent(flatten(this.children.map(function (child) { return child.toLines(); }))),
            ["}"],
            [("export = " + this.name + ";")],
        ]);
    };
    return TypeScriptRootModule;
})(TypeScriptSource);
