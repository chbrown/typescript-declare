/// <reference path="type_declarations/DefinitelyTyped/node/node.d.ts" />
import fs = require('fs');
import path = require('path');
import child_process = require('child_process');

var tsc_filepath = path.join(__dirname, 'node_modules/.bin/tsc');

export function generateTypeDeclaration(name: string, config: any) {
  var root = new TypeScriptRootModule(name);
  buildSourceTree(config, root);

  // move references and external imports to the root module; strip relative imports
  root.children.forEach(source => percolateSourceTree(source, root));

  fs.writeFileSync('index.ts', root.toLines().join('\n'), {encoding: 'utf8'});
  child_process.execFile(tsc_filepath, ['-m', 'commonjs', '-t', 'ES5', '-d', 'index.ts'], (error, stdout, stderr) => {
    if (error) {
      console.log(stdout);
      console.error(stderr);
      process.exit(1);
    }

    console.error('compiled index.js')

    var index_d_ts = fs.readFileSync('index.d.ts', {encoding: 'utf8'});
    var name_d_ts = index_d_ts
      // change the internal module name to external at the very top
      .replace(`declare module ${name}`, `declare module "${name}"`)
      // remove the export at the very bottom
      .replace(`export = ${name};\n`, '');
    // finally, write the main type declarations
    fs.writeFileSync(`${name}.d.ts`, name_d_ts, {encoding: 'utf8'});
    console.error(`wrote ${name}.d.ts`);

    // clean up
    // we've built index.d.ts and index.js, so we don't need index.ts
    fs.unlinkSync('index.ts');
    // and we've effectively moved index.d.ts to <name>.d.ts, with some changes,
    // so we can delete the original index.d.ts
    fs.unlinkSync('index.d.ts');
  });
}

function pushAll<T>(array: T[], items: T[]): void {
  return Array.prototype.push.apply(array, items);
}

function flatten<T>(arrays: T[][]): T[] {
  return Array.prototype.concat.apply([], arrays);
}

function indent(lines: string[], prefix = '  '): string[] {
  return lines.map(line => '  ' + line);
}

function buildSourceTree(config: any, parent: TypeScriptSourceModule) {
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

function percolateSourceTree(source: TypeScriptSource | TypeScriptSourceModule, root: TypeScriptRootModule) {
  // filter out relative imports
  var requirements = source.requirements.filter(requirement => requirement.path[0] !== '.');
  // move remaining (external) imports to the root module
  pushAll(root.requirements, requirements);
  source.requirements = [];
  // move references to the root module
  pushAll(root.references, source.references);
  source.references = [];
  // recurse
  if (source instanceof TypeScriptSourceModule) {
     source.children.forEach(source => percolateSourceTree(source, root));
  }
}

const referenceRegExp = /^\/\/\/\s*<reference\s*path=(['"])([^\1]+)\1\s*\/>\s*$/;
const requirementRegExp = /^(var|import)\s*(\w+)\s*=\s*require\((['"])([^\3]+)\3\);$/;
function readSourceCodeSync(filename: string): TypeScriptSourceCode {
  var source = new TypeScriptSourceCode();

  fs.readFileSync(filename, {encoding: 'utf8'}).split(/\n/).forEach(line => {
    var match: RegExpMatchArray;
    if (match = line.match(referenceRegExp)) {
      source.references.push(match[2]);
    }
    else if (match = line.match(requirementRegExp)) {
      source.requirements.push({type: match[1], name: match[2], path: match[4]});
    }
    else {
      source.lines.push(line);
    }
  });

  return source;
}

interface Requirement {
  type: string; // 'var' or 'import'
  name: string;
  path: string;
}

/**
references: an array of the reference paths
*/
class TypeScriptSource {
  constructor(public references: string[] = [],
              public requirements: Requirement[] = []) { }

  toLines(): string[] {
    return flatten([
      this.references.map(reference => `/// <reference path="${reference}" />`),
      this.requirements.map(requirement => `${requirement.type} ${requirement.name} = require('${requirement.path}');`),
    ]);
  }
}

class TypeScriptSourceCode extends TypeScriptSource {
  constructor(public lines: string[] = []) { super() }

  toLines(): string[] {
    return flatten([
      super.toLines(),
      this.lines,
    ]);
  }
}


class TypeScriptSourceModule extends TypeScriptSource {
  constructor(public name: string, public children: TypeScriptSource[] = []) { super() }

  toLines(): string[] {
    return flatten([
      super.toLines(),
      [`export module ${this.name} {`],
        indent(flatten(this.children.map(child => child.toLines()))),
      [`}`],
    ]);
  }
}

class TypeScriptRootModule extends TypeScriptSource {
  constructor(public name: string, public children: TypeScriptSource[] = []) { super() }

  toLines(): string[] {
    return flatten([
      super.toLines(),
      [`module ${this.name} {`],
        indent(flatten(this.children.map(child => child.toLines()))),
      [`}`],
      [`export = ${this.name};`],
    ]);
  }
}
