/// <reference path="../type_declarations/DefinitelyTyped/node/node.d.ts" />
/// <reference path="../type_declarations/DefinitelyTyped/yargs/yargs.d.ts" />
import fs = require('fs');
import yargs = require('yargs');
import build = require('../build');

var argvparser = yargs
  .usage('Usage: tsc-declare -n <name> -f <config>')
  .describe({
    name: 'module name',
    filename: 'config file',
    help: 'print this help message',
    version: 'print version',
  })
  .alias({
    name: 'n',
    filename: 'f',
    help: 'h',
  })
  .boolean(['help', 'version']);

var argv = argvparser.argv;

if (argv.help) {
  yargs.showHelp();
}
else if (argv.version) {
  console.log(require('../package').version);
}
else {
  argv = argvparser.demand(['name', 'filename']).argv;
  var config = JSON.parse(fs.readFileSync(argv.filename, {encoding: 'utf8'}));
  build.generateTypeDeclaration(argv.name, config);
}
