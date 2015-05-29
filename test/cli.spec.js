/*jshint mocha:true*/
"use strict";

var chai = require('chai');
var expect = chai.expect;
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

describe('cli', function() {

    var cmd = 'bin/marc-record-serializer';
	
    it('Should return 1 without proper number of arguments', function() {

	var results = child_process.spawnSync(cmd);

	expect(results.status).to.equal(1);
	
    })

    it('Should return -1 with invalid record type', function() {

	var results = child_process.spawnSync(cmd, ['foo', '']);

	expect(results.status).to.equal(255);

    });

    it('Should return 0 and pass correct record data to stdout', function() {

	var file_in = 'test/files/AlephSequential/cli_in';
	var file_out = 'test/files/AlephSequential/cli_out';
	var results = child_process.spawnSync(cmd, [
	    'alephseq',
	    file_in
	]);

	expect(results.status).to.equal(0);
	expect(results.stdout.toString()).to.equal(
	    fs.readFileSync(file_out, {encoding: 'utf8'})
	);

    });

    it('Should return 0 and pass correct record data to stdout', function() {

	var file_in = 'test/files/MARCXML/cli_in';
	var file_out = 'test/files/MARCXML/cli_out';
	var results = child_process.spawnSync(cmd, [
	    'marcxml',
	    file_in
	]);

	expect(results.status).to.equal(0);
	expect(results.stdout.toString()).to.equal(
	    fs.readFileSync(file_out, {encoding: 'utf8'})
	);

    });

    it('Should return 0 and pass correct Aleph sequential record in JSON-format to stdout', function() {

	var file_in = 'test/files/AlephSequential/cli_in';
	var file_out = 'test/files/AlephSequential/cli_json_out';
	var results = child_process.spawnSync(cmd, [
	    '--json',
	    'alephseq',
	    file_in
	]);

	expect(results.status).to.equal(0);
	expect(results.stdout.toString()).to.equal(
	    fs.readFileSync(file_out, {encoding: 'utf8'})
	);

    });

    it('Should return 0 and pass correct MARC XML record in JSON-format to stdout', function() {

	var file_in = 'test/files/AlephSequential/cli_in';
	var file_out = 'test/files/AlephSequential/cli_json_out';
	var results = child_process.spawnSync(cmd, [
	    '--json',
	    'alephseq',
	    file_in
	]);

	expect(results.status).to.equal(0);
	expect(results.stdout.toString()).to.equal(
	    fs.readFileSync(file_out, {encoding: 'utf8'})
	);

    });
    
});