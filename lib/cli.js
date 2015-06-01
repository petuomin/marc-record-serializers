'use strict';

var fs = require('fs');
var Q = require('q');
var serializers = require('../lib/index');

module.exports = {
    
    /**
     * @param {array} [argv=process.argv] An array of arguments
     * @param {WritableStream} [stdout=process.stdout] Stream for output
     * @param {WritableStream} [stdout=process.stderr] Stream for errors
     * @return Number
     */
    cli: function(argv, stdout, stderr) {
	return Q.Promise(function(resolve, reject) {

	    var reader, convert_to_json, type, data;
	    var supported_types = ['alephseq', 'marcxml'];
	    var usage = 'marc-record-serializer [--json] <record-type> <data>\n\n' +
		'\tAvailable record types:\n' +
		'\t\talephseq\t-\tAleph sequential\n' +
		'\t\tmarcxml \t-\tMARC XML\n\n' +
		'\t--json - Print records in JSON representation\n';

	    /**
	     * @internal Get rid of command names if using process.argv
	     */
	    argv = argv === undefined ? process.argv.slice(2) : argv;
	    stdout = stdout === undefined ? process.stdout : stdout;
	    stderr = stderr === undefined ? process.stderr : stderr;

	    if (argv.length < 2) {
		stderr.write(usage);
		resolve(1);
	    } else if (argv.length === 3 && argv[0] === '--json') {
		convert_to_json = 1;
		type = argv[1];
		data = argv[2];
	    } else {
		type = argv[0];
		data = argv[1];	
	    }

	    if (supported_types.indexOf(type) === -1) {
		stderr.write(usage + '\n' + 'Unsupported record type\n');
		resolve(255);
	    } else if (!fs.existsSync(data)) {
		stderr.write('File "' + data + '" does not exist\n');
		resolve(255);
	    } else {

		switch (type) {
		case 'alephseq':
		    reader = new serializers.AlephSequential.Reader(fs.createReadStream(data));
		    break;
		case 'marcxml':
		    reader = new serializers.MARCXML.Reader(fs.createReadStream(data));
		    break;
		default:
		    stderr.write('Unsupported record type: ' + type + '\n');
		    resolve(255);
		}
		
		reader.on('data', function(record) {
		    stdout.write(convert_to_json ? JSON.stringify(record.toJsonObject()) : record.toString());
		});
		reader.on('end', function() {
		    stdout.write('\n');
		    resolve(0);
		});

	    }
	    
	});
    }

};