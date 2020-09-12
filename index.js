var fs = require('fs'),
    path = require('path'),
    osmtogeojson = require('osmtogeojson'),
    baseURL = 'http://overpass-api.de/api/interpreter?data=[out:json];';

function log() {
    console.warn.apply(console, Array.prototype.concat.apply(['[Overpass Layer]'], arguments));
};

class OverpassLayer {
    constructor(config) {
        config.commands.serve.option('overpass-url', {help: 'URL to Overpass API to use [Default: ' + baseURL + ']'});
        config.commands.serve.option('force-overpass', {help: 'Refetch overpass data even if local file exists [Default: false]', flag: true});
        config.beforeState('project:loaded', this.patchMML.bind(this));
    }

    patchMML(e) {
        if (!e.project.mml || !e.project.mml.Layer) return e.continue();
        var processed = 0, layer,
            force = e.project.config.parsed_opts['force-overpass'],
            config = e.project.config,
            incr = function () {
                processed++;
            },
            decr = function () {
                processed--;
                if (processed === 0) e.continue();
            };
        var onError = function (err) {
            decr();
            log('Got error: ' + err.message);
        };
        var processRequest = function (layer) {
            var onResponse = function (res) {
                if (res.statusCode !== 200) return onError(new Error('Bad response: ' + res.statusCode));
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
            var uri = baseURL + encodeURIComponent(layer.Datasource.request);
            config.helpers.request({uri: uri}).on('response', onResponse).on('error', onError);
        };
        incr();  // Be sure decr() will be called at least once
        for (var i = 0; i < e.project.mml.Layer.length; i++) {
            layer = e.project.mml.Layer[i];
            if (layer.Datasource && layer.Datasource.type === 'overpass' && layer.Datasource.request) {
                incr();
                if (!layer.Datasource.file) layer.Datasource.file = path.join(e.project.dataDir, layer.id + '.geojson');
                layer.Datasource.layer = 'OGRGeoJSON';
                layer.Datasource.type = 'ogr';
                layer.srs = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';
                if(fs.existsSync(layer.Datasource.file) && !force) {
                    log('File already exists and not force mode', layer.Datasource.file, 'Skipping');
                    decr();
                    continue;
                }
                log('Processing file', layer.Datasource.file);
                processRequest(layer);
            }
        }
        decr();
    };
}

exports = module.exports = { Plugin: OverpassLayer };
