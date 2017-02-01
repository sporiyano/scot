// Generated by CoffeeScript 1.11.1
(function() {
  var BoundingBox, Edge, Polygon, Shell, Vec, fgt, flt, polygon, ref;

  Shell = require('../shell.js');

  Vec = require('./vec');

  BoundingBox = require('./boundingbox');

  Edge = require('./edge');

  ref = require('./eps'), fgt = ref.fgt, flt = ref.flt;

  polygon = function(pts) {
    return new Polygon(pts.map(function(p) {
      return new Vec(p);
    }));
  };

  Polygon = (function() {
    function Polygon(verts) {
      this.verts = verts.slice(0);
    }

    Polygon.prototype.edges = function() {
      var i, k, ref1, results;
      results = [];
      for (i = k = 0, ref1 = this.verts.length; 0 <= ref1 ? k < ref1 : k > ref1; i = 0 <= ref1 ? ++k : --k) {
        results.push(new Edge(this.verts[i], this.verts[(i + 1) % this.verts.length]));
      }
      return results;
    };

    Polygon.prototype.contains = function(pt) {
      var count, i, j, k, ref1, xdesc;
      count = 0;
      for (i = k = 0, ref1 = this.verts.length; 0 <= ref1 ? k < ref1 : k > ref1; i = 0 <= ref1 ? ++k : --k) {
        j = (i + 1) % this.verts.length;
        xdesc = (this.verts[j].x() - this.verts[i].x()) * (pt.y() - this.verts[i].y()) / (this.verts[j].y() - this.verts[i].y()) + this.verts[i].x();
        if (((fgt(this.verts[i].y(), pt.y())) !== (fgt(this.verts[j].y(), pt.y()))) && (flt(pt.x(), xdesc))) {
          count++;
        }
      }
      return (count % 2) !== 0;
    };

    Polygon.prototype.containsEdge = function(edge) {
      var e, k, len, ref1;
      if (!this.contains(edge.p1)) {
        return false;
      }
      ref1 = this.edges();
      for (k = 0, len = ref1.length; k < len; k++) {
        e = ref1[k];
        if (e.crosses(edge)) {
          return false;
        }
      }
      return true;
    };

    Polygon.prototype.containsPoly = function(poly) {
      var e, k, len, ref1;
      ref1 = poly.edges();
      for (k = 0, len = ref1.length; k < len; k++) {
        e = ref1[k];
        if (!this.containsEdge(e)) {
          return false;
        }
      }
      return true;
    };

    Polygon.prototype.center = function() {
      var cx, cy, k, len, pt, ref1;
      cx = 0;
      cy = 0;
      ref1 = this.verts;
      for (k = 0, len = ref1.length; k < len; k++) {
        pt = ref1[k];
        cx += pt.x();
        cy += pt.y();
      }
      cx /= this.verts.length;
      cy /= this.verts.length;
      return new Vec([cx, cy]);
    };

    Polygon.prototype.toPbool = function() {
      var v;
      return {
        regions: [
          (function() {
            var k, len, ref1, results;
            ref1 = this.verts;
            results = [];
            for (k = 0, len = ref1.length; k < len; k++) {
              v = ref1[k];
              results.push([v.x(), v.y()]);
            }
            return results;
          }).call(this)
        ],
        inverted: false
      };
    };

    Polygon.fromPbool = function(pb) {
      var k, len, ref1, region, results;
      ref1 = pb.regions;
      results = [];
      for (k = 0, len = ref1.length; k < len; k++) {
        region = ref1[k];
        results.push(polygon(region));
      }
      return results;
    };

    Polygon.prototype.intersect = function(poly) {
      return Polygon.fromPbool(PolyBool.intersect(poly.toPbool(), this.toPbool()));
    };

    Polygon.prototype.union = function(poly) {
      return Polygon.fromPbool(PolyBool.union(poly.toPbool(), this.toPbool()));
    };

    Polygon.prototype.trim = function(poly) {
      return (this.intersect(poly))[0];
    };

    Polygon.prototype.subtract = function(poly) {
      return Polygon.fromPbool(PolyBool.difference(poly.toPbool(), this.toPbool()));
    };

    Polygon.prototype.xor = function(poly) {
      return Polygon.fromPBool(PolyBool.difference(poly.toPbool(), this.toPbool()));
    };

    Polygon.prototype.bbox = function() {
      if (this.bounds) {
        return this.bounds;
      } else {
        this.bounds = new BoundingBox().containing(this.verts);
        return this.bounds;
      }
    };

    Polygon.prototype.scale = function(factor) {
      var vert;
      this.verts = (function() {
        var k, len, ref1, results;
        ref1 = this.verts;
        results = [];
        for (k = 0, len = ref1.length; k < len; k++) {
          vert = ref1[k];
          results.push(vert.scale(factor));
        }
        return results;
      }).call(this);
      return this;
    };

    return Polygon;

  })();

  module.exports = {
    Polygon: Polygon,
    polygon: polygon
  };

}).call(this);

//# sourceMappingURL=polygon.js.map
