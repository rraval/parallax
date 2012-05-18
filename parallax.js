(function (exports) {
    var copy_properties = function(to, from) {
        for (var key in from) {
            to[key] = from[key];
        }
    }

    var ParallaxException = function(pos, input, expected) {
        this.name = 'ParallaxException';
        this.message = '[Offset ' + pos + ']: Expected ' + expected +
            '; Input: "' + input.slice(pos) + '"';
        this._expected = expected;
    }
    ParallaxException.prototype = new Error();
    ParallaxException.prototype.constructor = ParallaxException;

    var Parallax = function(parser) {
        this._parser = parser;
    }

    copy_properties(Parallax.prototype, {
        constructor: Parallax,

        parse: function(input, pos) {
            this._pos = pos || 0;
            this._input = input;
            return this._parser(this.magic(this));
        },

        magic: function(_this) {
            return function(arg) {
                var type = typeof arg;

                return (type == 'undefined') ? _this :
                    (type == 'object') ? _this._choice(_this, arg) :
                    (type == 'function') ? arg(_this.magic(_this)) :
                    /*(type == 'string') ?*/ _this.string(arg);
            };
        },

        _choice: function(_this, lst) {
            var tried = 0;
            var expected = [];
            var errmsg = null;

            for (var key in lst) {
                var parser = lst[key];
                if (typeof parser == 'function') {
                    try {
                        var p = new Parallax(parser);
                        var output = p.parse(_this._input, _this._pos);
                        _this._pos = p._pos;
                        return output;
                    } catch (e) {
                        if (e instanceof ParallaxException) {
                            e._expected.length && expected.push(e._expected);
                        } else {
                            throw e;
                        }
                    }
                } else {
                    // assume string error message
                    errmsg = parser;
                }
                ++tried;
            }

            if (tried > 1) {
                // not optional
                if (errmsg && expected.length !== 0) {
                    errmsg += " (missing " + expected.join(" or ") + ")";
                } else if (expected.length !== 0) {
                    errmsg = expected.join(" or ");
                } else if (!errmsg) {
                    errmsg = "something else";
                }

                throw new ParallaxException(_this._pos, _this._input, errmsg);
            }

            return undefined;
        },

        string: function(expected) {
            return function($) {
                var _this = $();

                var got = _this._input.slice(
                    _this._pos,
                    _this._pos + expected.length
                );

                if (got != expected) {
                    throw new ParallaxException(
                        _this._pos,
                        _this._input,
                        '"' + expected + '"'
                    );
                }

                _this._pos += expected.length;
                return expected;
            };
        },

        takeWhile: function(pred) {
            return function($) {
                var _this = $();

                var newpos = _this._pos;
                while (newpos < _this._input.length &&
                        pred(_this._input.charAt(newpos))) {
                    ++newpos;
                }

                var output = _this._input.slice(_this._pos, newpos);
                _this._pos = newpos;
                return output;
            }
        },

        takeTill: function(pred) {
            return function($) {
                var _this = $();

                var newpos = _this._pos;
                while (newpos < _this._input.length &&
                        !pred(_this._input.charAt(newpos))) {
                    ++newpos;
                }

                var output = _this._input.slice(_this._pos, newpos);
                _this._pos = newpos;
                return output;
            }
        },

        _ensure1: function(func, arg) {
            return function($) {
                var _this = $();
                var output = $(_this[func](arg));

                if (output.length === 0) {
                    throw new ParallaxException(
                        _this._pos,
                        _this._input,
                        ""
                    );
                }

                return output;
            }
        },

        takeWhile1: function(pred) {
            return this._ensure1('takeWhile', pred);
        },

        takeTill1: function(pred) {
            return this._ensure1('takeTill', pred);
        },

        many: function(parser) {
            return function($) {
                var _this = $();
                var results = [];

                while (true) {
                    try {
                        var p = new Parallax(parser);
                        var output = p.parse(_this._input, _this._pos);
                        _this._pos = p._pos;
                        results.push(output);
                    } catch (e) {
                        if (e instanceof ParallaxException) {
                            break;
                        } else {
                            throw e;
                        }
                    }
                }

                return results;
            }
        },

        many1: function(parser) {
            return function($) {
                var _this = $();
                var results = [];
                var exception;

                while (true) {
                    try {
                        var p = new Parallax(parser);
                        var output = p.parse(_this._input, _this._pos);
                        _this._pos = p._pos;
                        results.push(output);
                    } catch (e) {
                        if (e instanceof ParallaxException) {
                            exception = e;
                            break;
                        } else {
                            throw e;
                        }
                    }
                }

                if (results.length == 0) {
                    throw exception;
                }

                return results;
            }
        },

        endOfInput: function($) {
            var _this = $();

            if (!$(_this.atEnd)) {
                throw new ParallaxException(
                    _this._pos,
                    _this._input,
                    'end of input'
                );
            }

            return true;
        },

        /* predicates */
        atEnd: function($) {
            var _this = $();
            return _this._pos >= _this._input.length;
        },

        isSpace: function(c) {
            return c == ' ' ||
                c == '\t' ||
                c == '\v' ||
                c == '\r' ||
                c == '\n';
        },

        /* FIXME: won't work in non ascii locales */
        isDigit: function(c) {
            c = c.charCodeAt(0);
            return c >= 0x30 && c <= 0x39;
        },

        /* a few standard parsers */
        spaces: function($) {
            $($().takeWhile($().isSpace));
        },

        number: function($) {
            var sign = $([$('-')]);
            sign = (sign) ? -1 : 1;

            var snum = $([$().takeWhile1($().isDigit), 'digit']);

            var num = 0;
            for (var i = 0; i < snum.length; ++i) {
                /* FIXME: locale issues */
                num *= 10;
                num += snum.charCodeAt(i) - 0x30;
            }

            return num * sign;
        }
  });

  exports.Parallax = Parallax;
  exports.ParallaxException = ParallaxException;
})(window);

