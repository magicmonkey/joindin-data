var request = require('request');
var crypto  = require('crypto');
var fs      = require('fs');
var async   = require('async');
var mkdirp  = require('mkdirp');
var util    = require('util');

// First get the events

function getEvents(uri) {

    util.print(">");
    request({uri:uri, json:true, gzip:true}, function(err, res, body) {
        util.print("<");
        if (err) throw err;

        async.eachLimit(body.events, 10, function(ev, cb) {

            async.waterfall([

                // Progress meter
                function(cb) {
                    util.print('e');
                    cb();
                },

                // Generate a filesystem-friendly "unique" ID
                function(cb) {
                    var sha1 = crypto.createHash('sha1');
                    sha1.update(ev.uri);
                    var dirname = sha1.digest('hex').substr(0, 6);
                    cb(null, dirname);
                },

                // Create the dir for the event
                function(dirname, cb) {
                    mkdirp('events/data/' + dirname, function(e) {cb(null, dirname);});
                },

                // Write the raw event structure
                function(dirname, cb) {
                    var file = fs.createWriteStream('events/data/' + dirname + '/raw.json')
                    file.on('open', function() {
                        file.write(JSON.stringify(ev, null, 2) + "\n", 'utf8', function(){file.end();});
                    });
                    file.on('finish', function() {
                        cb(null, dirname);
                    });
                },

                // Write the field-by-field event data
                function(dirname, cb) {
                    async.each(Object.keys(ev), function(key, cb) {
                        var file = fs.createWriteStream('events/data/' + dirname + '/' + key)
                        file.on('open', function() {
                            file.write(JSON.stringify(ev[key], null, 2) + "\n", function(){file.end();});
                        });
                        file.on('finish', function() {
                            cb();
                        });
                    });
                    cb(null, dirname);
                },

                // Create links into the event
                function(dirname, cb) {
                    
                    async.parallel([

                        function(cb) {
                            // - by start date
                            var dt = new Date(ev.start_date);
                            var dirname2 = 'events/by-start-date/' + dt.getUTCFullYear() + '/' + (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate();
                            mkdirp(dirname2, function() {
                                fs.symlink('../../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                    cb();
                                });
                            });
                        },

                        function(cb) {
                            // - by CFP start date
                            var dt = new Date(ev.cfp_start_date);
                            var dirname2 = 'events/by-cfp-start-date/' + dt.getUTCFullYear() + '/' + (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate();
                            mkdirp(dirname2, function() {
                                fs.symlink('../../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                    cb();
                                });
                            });
                        },

                        function(cb) {
                            // - by CFP end date
                            var dt = new Date(ev.cfp_end_date);
                            var dirname2 = 'events/by-cfp-end-date/' + dt.getUTCFullYear() + '/' + (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate();
                            mkdirp(dirname2, function() {
                                fs.symlink('../../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                    cb();
                                });
                            });
                        },

                        function(cb) {
                            // - by timezone
                            var dirname2 = 'events/by-timezone/' + ev.tz_continent + '/' + ev.tz_place;
                            mkdirp(dirname2, function() {
                                fs.symlink('../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                    cb();
                                });
                            });
                        },

                        function(cb) {
                            // - by all "on" dates
                            var curr = new Date(ev.start_date);
                            var end = new Date(ev.end_date);
                            async.whilst (
                                function() {return curr < end;},
                                function(next) {
                                    var dirname2 = 'events/by-on-date/' + curr.getUTCFullYear() + '/' + (curr.getUTCMonth() + 1) + '/' + curr.getUTCDate();
                                    mkdirp(dirname2, function() {
                                        fs.symlink('../../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                            curr.setDate(curr.getDate() + 1);
                                            next();
                                        });
                                    });
                                },
                                function() {
                                    cb();
                                }
                            );
                        },

                        function(cb) {
                            // - by all CFP "on" dates
                            var curr = new Date(ev.cfp_start_date);
                            var end = new Date(ev.cfp_end_date);
                            async.whilst (
                                function() {return curr < end;},
                                function(next) {
                                    var dirname2 = 'events/by-cfp-on-date/' + curr.getUTCFullYear() + '/' + (curr.getUTCMonth() + 1) + '/' + curr.getUTCDate();
                                    mkdirp(dirname2, function() {
                                        fs.symlink('../../../../data/' + dirname, dirname2 + '/' + dirname, function() {
                                            curr.setDate(curr.getDate() + 1);
                                            next();
                                        });
                                    });
                                },
                                function() {
                                    cb();
                                }
                            );
                        },

                    ], function() {cb(null, dirname);});
                },

                // Get the talks data for the event
                function(dirname, cb) {

                    cb();return;
                    if (ev.talks_count > 0) {
                        request({uri:ev.talks_uri + '?verbose=yes', json:true, gzip:true}, function(err, res, body) {

                            async.eachLimit(body.talks, 10, function(tk, cb) {
                                async.waterfall([
                                    
                                    // Generate a filesystem-friendly "unique" ID
                                    function(cb) {
                                        var sha1 = crypto.createHash('sha1');
                                        sha1.update(tk.uri);
                                        var talkdirname = sha1.digest('hex').substr(0, 6);
                                        cb(null, talkdirname);
                                    },

                                    // Create the dir for the talk
                                    function(talkdirname, cb) {
                                        mkdirp('events/talks/data/' + talkdirname, function(e) {cb(null, talkdirname);});
                                    },

                                    // Write the raw talk data
                                    function(talkdirname, cb) {
                                        var file = fs.createWriteStream('events/talks/data/' + talkdirname + '/raw.json')
                                        file.on('open', function() {
                                            file.write(JSON.stringify(tk, null, 2) + "\n", 'utf8', function(){file.end();});
                                        });
                                        file.on('finish', function() {
                                            cb(null, talkdirname);
                                        });
                                    },

                                    // Write the field-by-field talk data
                                    function(talkdirname, cb) {
                                        async.each(Object.keys(tk), function(key, cb) {
                                            var file = fs.createWriteStream('events/talks/data/' + talkdirname + '/' + key)
                                            file.on('open', function() {
                                                file.write(JSON.stringify(tk[key], null, 2) + "\n", function(){file.end();});
                                            });
                                            file.on('finish', function() {
                                                cb();
                                            });
                                        });
                                        cb(null, talkdirname);
                                    },


                                ], cb);
                            },
                            // Check if there's another page of talks
                            function() {
                                // TODO: this
                            }
                            );

                        });
                    } else {
                        cb();
                    }
                    
                }
                
            ], cb);

        },

        // Check if there's another page of events
        function(err) {
            if (body.meta.next_page) {
                getEvents(body.meta.next_page);
            }
        }
        );
                    
    });

}

getEvents('http://api.joind.in/v2.1/events?start=0&resultsperpage=100&verbose=yes');

