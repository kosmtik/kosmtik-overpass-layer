var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    osmtogeojson = require('osmtogeojson'),
    baseURL = 'http://overpass-api.de/api/interpreter?data=[out:json];';

var log = function () {
    console.warn.apply(console, Array.prototype.concat.apply(['[Overpass Layer]'], arguments));
};

var OverpassLayer = function (config) {
    config.commands.project.option('overpass-url', {help: 'URL to Overpass API to use [Default: ' + baseURL + ']'});
    config.commands.project.option('force-overpass', {help: 'Refetch overpass data even if local file exists [Default: false]', flag: true});
    config.beforeState('project:loaded', this.patchMML.bind(this));
};

OverpassLayer.prototype.patchMML = function (e) {
    if (!e.project.mml || !e.project.mml.Layer) return;
    var processed = 0, layer,
        length = e.project.mml.Layer.length,
        force = e.project.config.parsed_opts['force-overpass'],
        incr = function () {
            if (processed === 0) e.start();
            processed++;
        },
        decr = function () {
            processed--;
            if (processed === 0) e.end();
        };
    var onError = function (err) {
        decr();
        log('Got error: ' + e.message);
    };
    var processRequest = function (layer) {
        var onResponse = function (res) {
            if (res.statusCode !== 200) {
                log('Bad response', res.statusCode);
                decr();
                return;
            }
            var output = '';
            res.setEncoding('utf8');
            res.on('data', function (data) {
                output += data;
            });
            res.on('end', function () {
                output = JSON.parse(output);
                output = osmtogeojson(output, {flatProperties: true});
                output = JSON.stringify(output);
                fs.writeFileSync(layer.Datasource.file, output);
                delete layer.Datasource.request;
                log('Done', layer.Datasource.file);
                decr();
            });
        };
        http.get(baseURL + encodeURIComponent(layer.Datasource.request), onResponse).on('error', onError);
    };
    for (var i = 0; i < e.project.mml.Layer.length; i++) {
        layer = e.project.mml.Layer[i];
        if (layer.Datasource && layer.Datasource.type === 'overpass' && layer.Datasource.request) {
            incr();
            if (!layer.Datasource.file) layer.Datasource.file = path.join(e.project.dataDir, layer.id + '.geojson');
            layer.Datasource.layer = 'OGRGeoJSON';
            layer.Datasource.type = 'ogr';
            layer.srs = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";
            if(fs.existsSync(layer.Datasource.file) && !force) {
                log('File already exists and not force mode', layer.Datasource.file, 'Skipping');
                decr();
                continue;
            }
            log('Processing file', layer.Datasource.file);
            processRequest(layer);
        }
    }
};

exports.Plugin = OverpassLayer;
