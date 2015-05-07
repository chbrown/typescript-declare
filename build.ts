/// <reference path="type_declarations/DefinitelyTyped/node/node.d.ts" />
import fs = require('fs');
import child_process = require('child_process');

export function generateTypeDeclaration(name: string, config: any) {
  var root = new SourceTreeRootModule(name);
  buildSourceTree(config, root);

  fs.writeFileSync('index.ts', root.toString(), {encoding: 'utf8'});
  child_process.execSync('tsc -m commonjs -t ES5 -d index.ts');
  console.error('compiled index.js')

  // okay, now that we've build index.d.ts and index.js,
  // we don't need index.ts any longer
  fs.unlinkSync('index.ts');

  var index_d_ts = fs.readFileSync('index.d.ts', {encoding: 'utf8'});
  var name_d_ts = index_d_ts
    // change the internal module name to external at the very top
    .replace(`declare module ${name}`, `declare module "${name}"`)
    // remove the export at the very bottom
    .replace(`export = ${name};\n`, '');

  // we've effectively moved index.d.ts to <name>.d.ts, with some changes,
  // so we can delete the original index.d.ts
  fs.unlinkSync('index.d.ts');

  // finally, write the main type declarations
  fs.writeFileSync(`${name}.d.ts`, name_d_ts, {encoding: 'utf8'});
  console.error(`wrote ${name}.d.ts`);
}

const referenceRegExp = /^\/\/\/\s*<reference\s*path=(['"])([^\1]+)\1\s*\/>\s*$/;
const requirementRegExp = /^(var|import)\s*(\w+)\s*=\s*require\((['"])([^\3]+)\3\);$/;

function flatten<T>(arrays: T[][]): T[] {
  return Array.prototype.concat.apply([], arrays);
}

function indent(lines: string[], prefix = '  '): string[] {
  return lines.map(line => '  ' + line);
}

function buildSourceTree(config: any, parent: SourceTreeModule) {
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
      source.requirements = source.requirements.filter(requirement => requirement.path[0] !== '.');
      source_tree_module.children.push(source);
    }
    else {
      buildSourceTree(module_value, source_tree_module);
    }
  }
}

class SourceTreeModule {
  constructor(public name: string, public children: {toLines(): string[]}[] = []) { }
  toLines(): string[] {
    return flatten([
      [`export module ${this.name} {`],
        indent(flatten(this.children.map(child => child.toLines()))),
      [`}`],
    ]);
  }
  toString(): string {
    return this.toLines().join('\n');
  }
}

class SourceTreeRootModule extends SourceTreeModule {
  toLines(): string[] {
    return flatten([
      [`module ${this.name} {`],
        indent(flatten(this.children.map(child => child.toLines()))),
      [`}`],
      [`export = ${this.name};`],
    ]);
  }
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
              public requirements: Requirement[] = [],
              public lines: string[] = []) { }

  toLines(): string[] {
    return flatten([
      this.references.map(reference => `/// <reference path="${reference}" />`),
      this.requirements.map(requirement => `${requirement.type} ${requirement.name} = require('${requirement.path}');`),
      this.lines,
    ]);
  }

  static readFileSync(filename: string): TypeScriptSource {
    var source = new TypeScriptSource();

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
}
