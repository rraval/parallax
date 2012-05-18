Parallax
========

Parser Combinator Library in JavaScript. Modelled after [attoparsec][], but made to adopt JavaScript idioms instead of [trying to port Haskell to the browser][jsparsec]

[attoparsec]: http://hackage.haskell.org/package/attoparsec
[jsparsec]: http://code.google.com/p/jsparsec/

Introduction
------------

This library was written during one coffee and beer fueled hackathon. As such, code quality is probably subpar, and please don't judge me too much :)

If you're the fidgety kind of person, feel free to copy-paste and play with the examples at http://zeroindexed.com/parallax/

What Makes a Parser?
--------------------

In Parallax, a parser is merely a function that accepts a single magical argument. We'll talk about this argument in a bit, but I've decided to call it `$`. You can call it whatever you want: `_`, `p`, and `your_mom` are other popular choices. This parser function can do all the things regular JavaScript functions do, they can compute things, call other functions, and return values:

```javascript
function three($) {
    var a = 1 + 2;
    return a;
}
```

Before we get into other things, let's take a look at how we run a parser on some string:

```javascript
// `three` is our function above
(new Parallax(three)).parse("something"); // this returns `3`
```

Okay, so we can evalute JavaScript functions, although the string we provided doesn't seem to affect our so called parser at all. Let's fix that.

Basic Combinators
-----------------

Remember that funky `$` parameter our parser was given. Well, it's actually a function, and you can call it with a single argument to do multiple magical things.

If you call `$` with a string, it returns a parser that matches and returns that string. Note that in our nomenclature, a "parser" is merely that function that takes a single argument and does things to it, and so it's really no different from our `three` "parser" above.

Great, now we can create parsers (functions really) that match certain static strings, but so what? Well, wouldn't it be cool if you could compose a parser within another parser?

Remember when I said `$` did magical things? Well it does them based on the type of argument passed in, and if you pass in a function, it assumes it's a parser and composes it into the current parser. Given our new found wisdom, let's write a new parser:

```javascript
function parseFoo($) {
    var matchFoo = $("foo"); // this is a function like `parseFoo` and `three`
    return $(matchFoo);
}
(new Parallax(parseFoo)).parse("foo"); // this returns `"foo"`
```

Let's take a step back and examine what we did here. We created a parser `matchFoo` that consumes the string `"foo"`. We then composed it into our parser, which consumed the string from our current position (the start of the input in this case), updated our current position in the input, and returned the consumed string.

Well I'll be damned if that ain't cool. What happens if we try to parse something that isn't `"foo"`?

```javascript
try {
    (new Parallax(parseFoo)).parse("bar");
} catch (e) {
    e.toString(); // this is 'ParallaxException: [Offset 0]: Expected "foo"; Input: "bar"'
}
```

Yes, Parallax automagically generates human readable error messages. Who said computers were unfriendly?

More Magic
----------

I've used variations of the word "magic" about 5 times so far. Wanna see more magic related to the `$` parameter? Sure, you do!

One issue with our `parseFoo` parser is that it doesn't care about trailing input. So if we tried to parse the string `"foobar"`, it would match the inital `"foo"` and carry on its happy way. Making it so that we only match the string `"foo"` is non-trivial given the features that have been introduced, so clearly magic is called for.

Remember when I said `$` was a function that takes a single argument and does magical things based on the type of its argument? Well I sort of lied. Isn't that funny?

If you pass no arguments to `$` (or equivalently pass in `undefined`), it returns a dictionary with a few handy parsers already defined. One of them is `endOfInput`, which is what we'll compose to match the end of input:

```javascript
function parseOnlyFoo($) {
    $($("foo"));
    $($().endOfInput);
    return "and not a single foo was given!";
}
(new Parallax(parseFoo)).parse("foo"); // this returns `"and not a single foo was given!"`
```

Trying to parse `"bar"` gives the same error message as before, but now parsing `"foobar"` yields a new error message: `'ParallaxException: [Offset 3]: Expected end of input; Input: "bar"'` (how aboot that error message generation, eh?)

Advanced Combinators
--------------------

The object returned by `$()` contains a few other combinators that are super useful.

`$().many` applies a parser 0 or more times and returns a list of the results of that parser.

```javascript
function manyFoo($) {
    return $($().many($("foo")));
}
(new Parallax(manyFoo)).parse("foofoofoo"); // returns `["foo", "foo", "foo"]`
```

Note the part about 0 times. For example:

```javascript
function manyFoo($) {
    return $($().many($("foo")));
}
(new Parallax(manyFoo)).parse("bar"); // returns `[]`
```

`$().takeWhile` and `$().takeTill` accept a predicate function and consume input while the predicate returns `true` or until it returns `true` respectively. The predicate is a unary function that takes a character as an argument and returns `true` or `false`.

There also exist `$().many1`, `$().takeWhile1`, and `$().takeTill1` which ensure non-empty results (think of them as the analogue to regular expression's `+` operator compared to the `\*` operator).

Finally, `$().atEnd` is a parser that consumes no input, and if composed, returns true if and only if the input has been completely consumed.

Even More Magic
---------------

If we ever found a way to harvest magic for energy, `$` could heat Toronto for a month during winter. Since that's currently impossible (and if it isn't, please send me a pull request supporting this!), let's trudge right along.

Wrapping a parser in a unary list makes that parser optional (and composes it into the current parser). For example:

```javascript
function optionalFoo($) {
    return $([$("foo")]);
}
(new Parallax(optionalFoo)).parse("foo");   // returns `"foo"`
(new Parallax(optionalFoo)).parse("");      // returns `undefined`
(new Parallax(optionalFoo)).parse("bar");   // returns `undefined`
```

Remember when I said `$` did magical things based on the type of its argument? Well I lied again!

Passing in more than one parser in a list represents choice. Parallax will try the first parser, and if that fails, tries the second, and so on and so forth until something passes and it returns that value. For example:

```javascript
function parseFooOrBar($) {
    return $([
        $("foo"),
        $("bar")
    ]);
}
(new Parallax(parseFooOrBar)).parse("foo"); // returns `"foo"`
(new Parallax(parseFooOrBar)).parse("bar"); // returns `"bar"`
```

Once again, error messages work as expected:

```javascript
try {
    (new Parallax(parseFooOrBar)).parse("baz");
} catch (e) {
    e.toString(); // this is 'ParallaxException: [Offset 0]: Expected "foo" or "bar"; Input: "baz"'
}
```

Customizing Errors
------------------

While Parallax's automatic error message generators will often do the right thing, they fall short sometimes. The most notable example comes from `$().takeWhile1` and its like, because it doesn't know of a human readable description for your supplied predicate function (so instead, it generates no error message save for a generic failure one). You can annotate the error message of a single parser's failure by wrapping it in a 2-list of the form `[parser, annotation]`:

```javascript
// only works for ASCII
function isDigit(c) {
    c = c.charCodeAt(0);
    return c >= 0x30 && c <= 0x39;
}

function parseNumber($) {
    return $([$().takeWhile1(isDigit), 'digit']);
}

try {
    (new Parallax(parseNumber)).parse("foo");
} catch (e) {
    e.toString(); // this is 'ParallaxException: [Offset 0]: Expected digit; Input: "foo"'
}
```

You can also annotate the error message for the choice combinator:

```javascript
function parseCategory($) {
    return $([
        $("university"),
        $("hospital"),
        'category'
    ]);
}

try {
    (new Parallax(parseCategory)).parse("foo");
} catch (e) {
    e.toString(); // this is 'ParallaxException: [Offset 0]: Expected category (missing "university" or "hospital"); Input: "foo"'
}
```

A Rudimentary Expression Evaluator
----------------------------------

FIXME: write this
