"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const assert = require("assert");
const github_1 = require("./github");
mocha_1.suite("GithubAPI Tests", function () {
    mocha_1.test("decidePath", function () {
        assert.equal(github_1.decidePath("a"), "1/a");
        assert.equal(github_1.decidePath('"a"'), "1/a");
        assert.equal(github_1.decidePath("a1"), "2/a1");
        assert.equal(github_1.decidePath("aac"), "3/a/aac");
        assert.equal(github_1.decidePath("weld"), "we/ld/weld");
        assert.equal(github_1.decidePath("weldmock"), "we/ld/weldmock");
        assert.equal(github_1.decidePath("e2fslibs-sys"), "e2/fs/e2fslibs-sys");
        assert.equal(github_1.decidePath('"e2fslibs-sys"'), "e2/fs/e2fslibs-sys");
        assert.equal(github_1.decidePath('"Inflector"'), "in/fl/inflector");
    });
});
//# sourceMappingURL=github.test.js.map