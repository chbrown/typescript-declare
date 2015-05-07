var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="type_declarations/DefinitelyTyped/node/node.d.ts" />
var fs = require('fs');
var child_process = require('child_process');
function generateTypeDeclaration(name, config) {
    var root = new SourceTreeRootModule(name);
    buildSourceTree(config, root);
    fs.writeFileSync('index.ts', root.toString(), { encoding: 'utf8' });
    child_process.execSync('tsc -m commonjs -t ES5 -d index.ts');
    console.error('compiled index.js');
    // okay, now that we've build index.d.ts and index.js,
    // we don't need index.ts any longer
    fs.unlinkSync('index.ts');
    var index_d_ts = fs.readFileSync('index.d.ts', { encoding: 'utf8' });
    var name_d_ts = index_d_ts
        .replace("declare module " + name, "declare module \"" + name + "\"")
        .replace("export = " + name + ";\n", '');
    // we've effectively moved index.d.ts to <name>.d.ts, with some changes,
    // so we can delete the original index.d.ts
    fs.unlinkSync('index.d.ts');
    // finally, write the main type declarations
    fs.writeFileSync(name + ".d.ts", name_d_ts, { encoding: 'utf8' });
    console.error("wrote " + name + ".d.ts");
}
exports.generateTypeDeclaration = generateTypeDeclaration;
var referenceRegExp = /^\/\/\/\s*<reference\s*path=(['"])([^\1]+)\1\s*\/>\s*$/;
var requirementRegExp = /^(var|import)\s*(\w+)\s*=\s*require\((['"])([^\3]+)\3\);$/;
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
        var source_tree_module = new SourceTreeModule(module_name);
        // add it to the provided parent
        parent.children.push(source_tree_module);
        // recurse on object values, terminate on string values
        var module_value = config[module_name];
        if (typeof module_value === 'string') {
            var filename = module_value + '.ts';
            var source = TypeScriptSource.readFileSync(filename);
            // strip relative imports
            source.requirements = source.requirements.filter(function (requirement) { return requirement.path[0] !== '.'; });
            source_tree_module.children.push(source);
        }
        else {
            buildSourceTree(module_value, source_tree_module);
        }
    }
}
var SourceTreeModule = (function () {
    function SourceTreeModule(name, children) {
        if (children === void 0) { children = []; }
        this.name = name;
        this.children = children;
    }
    SourceTreeModule.prototype.toLines = function () {
        return flatten([
            [("export module " + this.name + " {")],
            indent(flatten(this.children.map(function (child) { return child.toLines(); }))),
            ["}"],
        ]);
    };
    SourceTreeModule.prototype.toString = function () {
        return this.toLines().join('\n');
    };
    return SourceTreeModule;
})();
var SourceTreeRootModule = (function (_super) {
    __extends(SourceTreeRootModule, _super);
    function SourceTreeRootModule() {
        _super.apply(this, arguments);
    }
    SourceTreeRootModule.prototype.toLines = function () {
        return flatten([
            [("module " + this.name + " {")],
            indent(flatten(this.children.map(function (child) { return child.toLines(); }))),
            ["}"],
            [("export = " + this.name + ";")],
        ]);
    };
    return SourceTreeRootModule;
})(SourceTreeModule);
/**
references: an array of the reference paths
*/
var TypeScriptSource = (function () {
    function TypeScriptSource(references, requirements, lines) {
        if (references === void 0) { references = []; }
        if (requirements === void 0) { requirements = []; }
        if (lines === void 0) { lines = []; }
        this.references = references;
        this.requirements = requirements;
        this.lines = lines;
    }
    TypeScriptSource.prototype.toLines = function () {
        return flatten([
            this.references.map(function (reference) { return ("/// <reference path=\"" + reference + "\" />"); }),
            this.requirements.map(function (requirement) { return (requirement.type + " " + requirement.name + " = require('" + requirement.path + "');"); }),
            this.lines,
        ]);
    };
    TypeScriptSource.readFileSync = function (filename) {
        var source = new TypeScriptSource();
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
    };
    return TypeScriptSource;
})();
