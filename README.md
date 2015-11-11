# kosmtik-overpass-layer

Add overpass layers to your Kosmtik project

Just add `"type": "overpass"` and a `request` key with your overpass query in
your Carto layer. The plugin will run the queries, cache them on disk, and transform
the layers in normal geojson layers.

## Example:

```
{
  "id": "natural",
  "geometry": "polygon",
  "extent": [1.2632799,43.1225469,1.2651281,43.1236188
  ],
  "Datasource": {
    "request": "area[name='Montbrun-Bocage'][admin_level=8]->.zone;(way(area.zone)[natural];);(._;>;);out;",
    "type": "overpass"
  }
}
```

## Install

While in your Kosmtik root, run:

`node index.js plugins --install kosmtik-overpass-layer`

## Issues and feature requests

Please report any issue or feature request on the [main kosmtik repository](https://github.com/kosmtik/kosmtik/issues).
