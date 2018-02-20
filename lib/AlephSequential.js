'use strict';

// Polyfill for Node
require('fast-text-encoding');

var Record = require('marc-record-js');
var util = require('util');
var fixedFieldTags = ['FMT', '001', '002','003','004','005','006','007','008','009'];

var AlephSequentialReader = function(stream) {

  var self = this,
    charbuffer = '',
    linebuffer = [],
    currentId;

  this.readable = true;
  this.count = 0;

  stream.on('data', function(data) {

    charbuffer += data.toString();

    while (1) { // eslint-disable-line no-constant-condition

      var pos = charbuffer.indexOf('\n');
      if (pos === -1) { break; }
      var raw = charbuffer.substr(0, pos);
      charbuffer = charbuffer.substr(pos+1);
      linebuffer.push(raw);

    }

    if (linebuffer.length > 0) {

      if (currentId === undefined) {
        currentId = getIdFromLine(linebuffer[0]);
      }

      var i=0;
      while (i < linebuffer.length) {
        if (linebuffer[i].length < 9) {
          break;
        }

        var lineId = getIdFromLine(linebuffer[i]);

        if (currentId !== lineId) {

          var record = linebuffer.splice(0,i);

          self.count++;

          try {
            self.emit('data', fromAlephSequential(record));
          } catch (excp) {
            self.emit('error', excp);
            break;
          }

          currentId = lineId;
          i=0;
        }
        i++;
      }
    }

  });

  stream.on('end', function() {
    if (linebuffer.length > 0) {
      self.count++;
      try {
        self.emit('data', fromAlephSequential(linebuffer));
      } catch (excp) {
        self.emit('error', excp);
        return;
      }
    }
    self.emit('end');
  });


  stream.on('error', function(error){
    self.emit('error', error);
  });

  function getIdFromLine(line) {
    return line.split(' ')[0];
  }
};

util.inherits(AlephSequentialReader, require('stream'));

/**
* This function was implemented by tvirolai (https://github.com/tvirolai)
**/
/**
* Determine the record format for the FMT field.
*/
function recordFormat(record) {
  var leader = record.leader;
  var l6 = leader.slice(6,7);
  var l7 = leader.slice(7,8);
  if (l6 === 'm') {
    return 'CF';
  } else if (['a', 't'].includes(l6) && ['b', 'i', 's'].includes(l7)) {
    return 'CR';
  } else if (['e', 'f'].includes(l6)) {
    return 'MP';
  } else if (['c', 'd', 'i', 'j'].includes(l6)) {
    return 'MU';
  } else if (l6 === 'p') {
    return 'MX';
  } else if (['g', 'k', 'o', 'r'].includes(l6)) {
    return 'VM';
  } else {
    return 'BK';
  }
}

/**
* Not a perfect implementation of Aleph sequential conversion...
* The conversion specification is available but it's' lacking: https://knowledge.exlibrisgroup.com/@api/deki/files/38711/Z00_and_Z00H.pdf?revision=1
* The specification doesn't mention that the text is cut by 1000 charactes boundary and periods are considered as boundary markers
* This implementation attempts to mimic the conversion done by marc_to_aleph.sh script and should at least produce a format which is accepted by Aleph
* Also, javascript strings are UTF-16 so conversion to bytes is necessary to cut the text at correct offsets
*/
function toAlephSequential(record) {
  var MAX_FIELD_LENGTH = 2000;
  var SPLIT_MAX_FIELD_LENGTH = 1000;

  var f001 = record.get(/^001/);
  var id = f001.length > 0 ? f001.shift().value : '000000000';
  var staticFields = [
    {
      tag: 'FMT',
      value: recordFormat(record)
    },
    {
      tag: 'LDR',
      value: record.leader
    }
  ];

  return staticFields.concat(record.fields).reduce(function(acc, field) {
    // Controlfield
    if (field.value) {
      var formattedField = id + ' ' + field.tag + '   L ' + field.value;
      return acc + formattedField + '\n';
      // Datafield
    } else {
      return acc + formatDatafield(field);
    }
  }, '');

  function formatDatafield(field) {
    var subfieldLines;
    var encoder = new TextEncoder('utf-8');
    var decoder = new TextDecoder('utf-8');

    var ind1 = field.ind1 && field.ind1.length > 0 ? field.ind1 : ' ';
    var ind2 = field.ind2 && field.ind2.length > 0 ? field.ind2 : ' ';
    var header = id + ' ' + field.tag + ind1 + ind2 + ' L ';

    var formattedSubfields = field.subfields.map(function(subfield) {
      var content = '';

      if (subfield.code.length > 0 || subfield.value.length > 0) {
        content = '$$' + subfield.code + subfield.value;
      }

      return encoder.encode(content);
    });

    var dataLength = formattedSubfields.reduce(function(acc, value) {
      return acc + value.length;
    }, 0);

    if (dataLength > MAX_FIELD_LENGTH) {
      subfieldLines = formattedSubfields.reduce(reduceToLines, {
        lines: []
      });

      return decode(subfieldLines).reduce(function(acc, line) {
        return acc + header + line + '\n';
      }, '');
    } else {
      return header + decode(formattedSubfields).join('') + '\n';
    }

    function decode(subfields) {
      return subfields.map(function(value) {
        return decoder.decode(value);
      });
    }

    /**
    * 1. Append subfields until MAX_FIELD_LENGTH is exceeded
    * 2. cut at the last subfield
    * 3. Append prefix to the next subfield and check if it exceeds SPLIT_MAX_FIELD_LENGTH
    *   - If it is, cut at separators or at boundary. Create a new line for each segment
    * 4. Repeat step 3 for the rest of the subfields
    **/
    function reduceToLines(result, subfield, index, arr) {
      var code, sliceOffset, slicedSegment;
      var tempLength = result.temp ? result.temp.length : 0;

      if (tempLength + subfield.length <= MAX_FIELD_LENGTH) {
        if (tempLength) {
          result.temp = concatByteArrays(result.temp, subfield);
        } else {
          result.temp = subfield;
        }
      } else {
        if (tempLength) {
          result.lines.push(result.temp);
          delete result.temp;
        }

        code = decoder.decode(subfield.slice(2, 3));
        iterate(subfield, index === 0);
      }

      // Flush
      if (index == arr.length -1) {
        result = result.lines.concat(result.temp);
      }

      return result;

      function concatByteArrays(a, b, ...args) {
        var length = [a,b].concat(args).reduce(function(acc, value) {
          return acc + value.length;
        }, 0);
        var arr = new Uint8Array(length);

        [a,b].concat(args).reduce(function(acc, value) {
          arr.set(value, acc);
          acc += value.length;
          return acc;
        }, 0);

        return arr;
      }

      function iterate(segment, firstCall) {
        var HYPHEN = 45;
        var SPACE = 32;
        var CARET = 94;
        var DOLLAR = 36;
        var PERIOD = 46;

        segment = firstCall ? segment : addPrefix(segment);

        if (segment.length <= SPLIT_MAX_FIELD_LENGTH) {
          result.temp = segment;
        } else {
          sliceOffset = getSliceOffset(segment);
          slicedSegment = sliceSegment(segment, sliceOffset);

          result.lines.push(slicedSegment);
          iterate(segment.slice(sliceOffset));
        }

        function addPrefix(arr) {
          var prefix;

          if (arr.slice(0, 2).every(function(value) {
            return value === DOLLAR;
          })) {
            prefix = '$$9^';
          } else {
            prefix = '$$9^^$$' + code;
          }

          return concatByteArrays(encoder.encode(prefix), arr);
        }

        function getSliceOffset(arr) {
          var offset = findSeparatorOffset(arr);

          if (!offset) {
            offset = findPeriodOffset(arr);
          }

          return offset ? offset : SPLIT_MAX_FIELD_LENGTH;

          function findSeparatorOffset(arr) {
            var offset = find();

            if (offset !== undefined) {
              // Append the number of chars in separator
              offset += 3;

              if (offset <= SPLIT_MAX_FIELD_LENGTH) {
                return offset;
              } else {
                return findSeparatorOffset(arr.slice(0, offset - 3));
              }
            }

            function find() {
              var index;
              var foundCount = 0;

              for (var i=arr.length - 1;i--;i >= 0) {
                if (foundCount === 0 && arr[i] === SPACE) {
                  foundCount++;
                } else if (foundCount > 0 && arr[i] === HYPHEN) {
                  foundCount ++;
                } else {
                  foundCount = 0;
                }

                if (foundCount === 3) {
                  index = i;
                  break;
                }
              }

              return index;
            }
          }

          function findPeriodOffset(arr) {
            var offset = find();

            if (offset !== undefined) {
              // Append the number of chars in separator
              offset += 2;
              if (offset <= SPLIT_MAX_FIELD_LENGTH) {
                return offset;
              } else {
                return findPeriodOffset(arr.slice(0, offset - 2));
              }
            }

            function find() {
              var index;
              var foundCount = 0;

              for (var i=arr.length - 1;i--;i >= 0) {
                if (foundCount === 0 && arr[i] === SPACE) {
                  foundCount++;
                } else if (foundCount > 0 && arr[i] === PERIOD) {
                  foundCount++;
                } else {
                  foundCount = 0;
                }

                if (foundCount === 2) {
                  index = i;
                  break;
                }
              }

              return index;
            }
          }
        }

        function sliceSegment(arr, offset) {
          var sliced = segment.slice(0, offset);

          if (sliced.slice(-1)[0] === SPACE) {
            sliced[sliced.length - 1] = CARET;
          }

          return sliced;
        }
      }

    }
  }
}

function fromAlephSequential(data) {

  var i=0;
  while (i < data.length) {

    var nextLine = data[i+1];
    if (nextLine !== undefined && isContinueFieldLine(nextLine)) {

      if (data[i].substr(-1) === '^') {
        data[i] = data[i].substr(0,data[i].length-1);
      }
      data[i] += parseContinueLineData(nextLine);
      data.splice(i+1,1);
      continue;
    }
    i++;
  }

  var record = new Record();
  record.fields = [];

  data.forEach(function(line) {
    var field = parseFieldFromLine(line);

    // Drop Aleph specific FMT fields.
    if (field.tag === 'FMT') {
      return;
    }

    if (field.tag === 'LDR') {
      record.leader = field.value;
    } else {
      record.fields.push(field);
    }

  });

  return record;
}

function parseContinueLineData(lineStr) {
  var field = parseFieldFromLine(lineStr);
  var firstSubfield = field.subfields[0];

  if (firstSubfield.value === '^') {
    return lineStr.substr(22);
  }
  if (firstSubfield.value === '^^') {
    return ' ' + lineStr.substr(26, lineStr.length-1);
  }
  throw new Error('Could not parse Aleph Sequential subfield 9-continued line.');
}

function isContinueFieldLine(lineStr) {
  var field = parseFieldFromLine(lineStr);

  if (isControlfield(field)) {
    return false;
  }

  var firstSubfield = field.subfields[0];

  if (firstSubfield === undefined) {
    return false;
  }

  return (firstSubfield.code === '9' && (firstSubfield.value === '^' || firstSubfield.value === '^^'));
}

function isControlfield(field) {
  if (field.subfields === undefined) {
    return true;
  }
}

function isFixFieldTag(tag) {
  return fixedFieldTags.indexOf(tag) !== -1;
}

function parseFieldFromLine(lineStr) {
  var tag = lineStr.substr(10,3);

  if (tag === undefined || tag.length != 3) {
    throw new Error('Could not parse tag from line: ' + lineStr);
  }

  if (isFixFieldTag(tag) || tag === 'LDR') {
    var data = lineStr.substr(18);
    return {tag: tag, value: data};
  } else {
    // varfield
    var ind1 = lineStr.substr(13,1);
    var ind2 = lineStr.substr(14,1);

    var subfieldData = lineStr.substr(18);

    var subfields = subfieldData.split('$$')
    .filter(function(sf) { return sf.length !== 0; })
    .map(function(subfield) {

      var code = subfield.substr(0,1);
      var value = subfield.substr(1);
      return {code: code, value: value};
    });

    return {
      tag: tag,
      ind1: ind1,
      ind2: ind2,
      subfields: subfields
    };

  }
}

module.exports = {
  Reader: AlephSequentialReader,
  Writer: undefined,
  toAlephSequential: toAlephSequential,
  fromAlephSequential: fromAlephSequential
};
