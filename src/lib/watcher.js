var fs = require('fs');
var path = require('path');

exports.watch = function (reqPath, onChange) {
    watchTree(path.resolve(reqPath), { ignoreDotFiles: true }, onChange);
};


// Copyright 2010-2011 Mikeal Rogers
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

function walk(dir, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    if (!callback.files) {
        callback.files = {};
    }
    if (!callback.pending) {
        callback.pending = 0;
    }
    callback.pending += 1;
    fs.stat(dir, function (err, stat) {
        if (err) {
            return callback(err);
        }
        callback.files[dir] = stat;
        fs.readdir(dir, function (err, files) {
            if (err) {
                return callback(err);
            }
            callback.pending -= 1;
            files.forEach(function (f, index) {
                f = path.join(dir, f);
                callback.pending += 1;
                fs.stat(f, function (err, stat) {
                    var enoent = false;
                    var done = false;

                    if (err) {
                        if (err.code === 'ENOENT') {
                            enoent = true;
                        } else {
                            return callback(err);
                        }
                    }
                    callback.pending -= 1;
                    done = callback.pending === 0;
                    if (!enoent) {
                        if (options.ignoreDotFiles && path.basename(f)[0] === '.') {
                            return done && callback(null, callback.files);
                        }
                        if (options.filter && options.filter(f, stat)) {
                            return done && callback(null, callback.files);
                        }
                        callback.files[f] = stat;
                        if (stat.isDirectory()) {
                            walk(f, options, callback);
                        }
                        done = callback.pending === 0;
                        if (done) {
                            callback(null, callback.files);
                        }
                    }
                });
            });
            if (callback.pending === 0) {
                callback(null, callback.files);
            }
        });
        if (callback.pending === 0) {
            callback(null, callback.files);
        }
    });
}

function watchTree(root, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    walk(root, options, function (err, files) {
        if (err) {
            throw err;
        }
        function fileWatcher(f) {
            fs.watchFile(f, options, function (c, p) {
                // Check if anything actually changed in stat
                if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() === c.mtime.getTime()) {
                    return;
                }
                files[f] = c;
                if (files[f].isDirectory()) {
                    fs.readdir(f, function (err, nfiles) {
                        if (err) {
                            return;
                        }
                        nfiles.forEach(function (b) {
                            var file = path.join(f, b);
                            if (!files[file] && (options.ignoreDotFiles !== true || b[0] !== '.')) {
                                fs.stat(file, function (err, stat) {
                                    callback(file, stat, null);
                                    files[file] = stat;
                                    fileWatcher(file);
                                });
                            }
                        });
                    });
                } else {
                    callback(f, c, p);
                }
                if (c.nlink === 0) {
                    // unwatch removed files.
                    delete files[f];
                    fs.unwatchFile(f);
                }
            });
        }
        fileWatcher(root);
        var i;
        for (i in files) {
            fileWatcher(i);
        }
    });
}