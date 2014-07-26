var request = require('request');
var crypto  = require('crypto');
var fs      = require('fs');
var async   = require('async');
var mkdirp  = require('mkdirp');

// First get the events

function getEvents(uri) {
    //console.log("*");
    request({uri:uri, json:true, gzip:true}, function(err, res, body) {
        if (err) throw err;

        async.eachLimit(body.events, 10, function(ev, cb) {

            async.waterfall([

                function(cb) {
                    // Generate a filesystem-friendly "unique" ID
                    var sha1 = crypto.createHash('sha1');
                    sha1.update(ev.uri);
                    var dirname = sha1.digest('hex').substr(0, 5);
                    cb(null, dirname);
                },

                function(dirname, cb) {
                    // Create the dir for the event
                    mkdirp('events/data/' + dirname, function(e) {cb(null, dirname);});
                },

                function(dirname, cb) {
                    // Write the raw event structure
                    var file = fs.createWriteStream('events/data/' + dirname + '/raw.json')
                    file.on('open', function() {
                        file.write(JSON.stringify(ev, null, 2) + "\n", 'utf8', function(){file.end();});
                    });
                    file.on('finish', function() {
                        cb(null, dirname);
                    });
                },

                function(dirname, cb) {
                    // Write the field-by-field event data
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

                function(dirname, cb) {
                    // Create links into the event
                    
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

                    ], function() {cb();});
                }

                // Get the talks data for the event
                
            ], cb);

        },

        // Check if there's another page of events
        function(err) {
            if (body.meta.next_page) {
                //getEvents(body.meta.next_page);
            }
        }
        );
                    
    });

}

getEvents('http://api.joind.in/v2.1/events?start=0&resultsperpage=5&verbose=yes');

