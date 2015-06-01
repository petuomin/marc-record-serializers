/*jshint mocha:true*/
"use strict";

var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');

describe('cli', function() {
    
    var cli = require('../lib/cli').cli;

    it('Should return 1 without proper number of arguments', function(doneCallback) {

	var stdout = {
	    write: function(chunk) {},
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli([], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(1);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }
	});	

    });

    it('Should return -1 with invalid record type', function(doneCallback) {

	var stdout = {
	    write: function(chunk) {},
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli(['', ''], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(255);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }
	});	

    });

    it('Should return -1 with invalid file', function(doneCallback) {

	var error = '';
	var stdout = {
	    write: function(chunk) {}
	};
	var stderr = {
	    write: function(chunk) {
		error += chunk;
	    }
	};

	cli(['alephseq', 'foo'], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(255);
		expect(error).to.equal('File "foo" does not exist\n');
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }
	});
	
    });

    it('Should return 0 and pass correct record data (From Aleph sequential) to stdout', function(doneCallback) {

	var file_in = 'test/files/AlephSequential/cli_in';
	var file_out = 'test/files/AlephSequential/cli_out';
	var result = '';
	var stdout = {
	    write: function(chunk) {
		result += chunk;
	    }
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli(['alephseq', file_in], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(0);
		expect(result).to.equal(
		    fs.readFileSync(file_out, {encoding: 'utf8'})
		);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }	    
	});	

    });

    it('Should return 0 and pass correct record data (From MARC XML) to stdout', function(doneCallback) {

	var file_in = 'test/files/MARCXML/cli_in';
	var file_out = 'test/files/MARCXML/cli_out';
	var result = '';
	var stdout = {
	    write: function(chunk) {
		result += chunk;
	    },
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli(['marcxml', file_in], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(0);
		expect(result).to.equal(
		    fs.readFileSync(file_out, {encoding: 'utf8'})
		);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }	    
	});	
	
    });

    it('Should return 0 and pass correct Aleph sequential record in JSON-format to stdout', function(doneCallback) {

	var file_in = 'test/files/AlephSequential/cli_in';
	var file_out = 'test/files/AlephSequential/cli_json_out';
	var result = '';
	var stdout = {
	    write: function(chunk) {
		result += chunk;
	    },
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli(['--json', 'alephseq', file_in], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(0);
		expect(result).to.equal(
		    fs.readFileSync(file_out, {encoding: 'utf8'})
		);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }
	});	

    });

    it('Should return 0 and pass correct MARC XML record in JSON-format to stdout', function(doneCallback) {

	var file_in = 'test/files/MARCXML/cli_in';
	var file_out = 'test/files/MARCXML/cli_json_out';
	var result = '';
	var stdout = {
	    write: function(chunk) {
		result += chunk;
	    },
	};
	var stderr = {
	    write: function(chunk) {}
	};

	cli(['--json', 'marcxml', file_in], stdout, stderr).then(function(status) {
	    try {
		expect(status).to.equal(0);
		expect(result).to.equal(
		    fs.readFileSync(file_out, {encoding: 'utf8'})
		);
		doneCallback();
	    } catch (excp) {
		doneCallback(excp);
	    }
	});	

    });

});