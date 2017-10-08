var fs = require("fs")
var { assert } = require('chai')
var parser = require("../src/index")

function print(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

function parseContract(source, options = {}) {
  var ast = parser.parse(source, options)
  assert.isOk(ast.children[0])
  return ast.children[0]
}

function parseNode(source, options = {}) {
  var contract = parseContract("contract test { " + source + " }", options)
  assert.isOk(contract.subNodes[0])
  return contract.subNodes[0]
}

function parseStatement(source, options = {}) {
  var ast = parseNode("function () { " + source + " }", options)
  assert.isOk(ast.body.statements[0])
  return ast.body.statements[0]
}

function parseExpression(source, options = {}) {
  var ast = parseNode("function () { " + source + "; }", options)
  assert.isOk(ast.body.statements[0].expression)
  return ast.body.statements[0].expression
}

function parseAssembly(source, options = {}) {
  var ast = parseNode("function () { assembly { " + source + " } }", options)
  assert.isOk(ast.body.statements[0].body.operations[0])
  return ast.body.statements[0].body.operations[0]
}


describe("#parse", () => {

  it("parses test file correctly", () => {
    var content = fs.readFileSync(__dirname + "/test.sol")
    parser.parse(content.toString())
  })

  it("throws ParserError on syntax error", () => {
    var source = "not good"
    assert.throws(() => {
      parser.parse(source)
    }, parser.ParseError)
  })

  it("supports tolerant mode", () => {
    var source = "not good"
    var root = parser.parse(source, { tolerant: true })
    assert.equal(root.errors.length, 1)
  })

  it("supports loc", () => {
    var source = "contract test { uint a; }"
    var root = parser.parse(source, { loc: true })
    assert.isOk(root.hasOwnProperty('loc'))
  })

  it("supports range", () => {
    var source = "contract test { uint a; }"
    var root = parser.parse(source, { range: true })
    assert.isOk(root.hasOwnProperty('range'))
  })

  describe('AST', () => {

    it("SourceUnit", () => {
      var ast = parser.parse("");
      assert.deepEqual(ast, {
        "type": "SourceUnit",
        "children": []
      });
    })

    it("EnumDefinition / EnumValue", () => {
      var ast = parseNode("enum Hello { A, B, C }")
      assert.deepEqual(ast, {
        "type": "EnumDefinition",
        "name": "Hello",
        "members": [
          {
            "type": "EnumValue",
            "name": "A"
          },
          {
            "type": "EnumValue",
            "name": "B"
          },
          {
            "type": "EnumValue",
            "name": "C"
          }
        ]
      })
    })

    it("UsingForDeclaration", () => {
      var ast = parseNode("using Lib for uint;")
      assert.deepEqual(ast, {
        "type": "UsingForDeclaration",
        "typeName": {
            "type": "ElementaryTypeName",
            "name": "uint"
          },
        "libraryName": "Lib"
      })

      ast = parseNode("using Lib for *;")
      assert.deepEqual(ast, {
        "type": "UsingForDeclaration",
        "typeName": null,
        "libraryName": "Lib"
      })

      ast = parseNode("using Lib for S;")
      assert.deepEqual(ast, {
        "type": "UsingForDeclaration",
        "typeName": {
            "type": "UserDefinedTypeName",
            "namePath": "S"
          },
        "libraryName": "Lib"
      })

    })

    it("PragmaDirective", () => {
      var ast = parser.parse("pragma solidity ^0.4.0;")
      var pragma = ast.children[0]
      assert.deepEqual(pragma, {
        "type": "PragmaDirective",
        "name": "solidity",
        "value": "^0.4.0"
      })
    })

    it("ContractDefinition", () => {
      var ast = parseContract("contract test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "contract"
      })

      // inheritance
      ast = parseContract("contract test is foo, bar {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [
          {
            "type": "InheritanceSpecifier",
            "baseName": {
              "type": "UserDefinedTypeName",
              "namePath": "foo"
            },
            "arguments": []
          },
          {
            "type": "InheritanceSpecifier",
            "baseName": {
              "type": "UserDefinedTypeName",
              "namePath": "bar"
            },
            "arguments": []
          }
        ],
        "subNodes": [],
        "kind": "contract"
      })

      // library
      ast = parseContract("library test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "library"
      })

      // interface
      ast = parseContract("interface test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "interface"
      })
    })

    it("FunctionDefinition", () => {
      var ast = parseNode("function foo(uint a) pure {}")
      assert.deepEqual(ast, {
        "type": "FunctionDefinition",
        "name": "foo",
        "parameters": {
          "type": "ParameterList",
          "parameters": [
            {
              "type": "Parameter",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "uint"
              },
              "name": "a",
              "storageLocation": null,
              "isStateVar": false,
              "isIndexed": false
            }
          ]
        },
        "body": {
          "type": "Block",
          "statements": []
        },
        "visibility": "default",
        "modifiers": [],
        "isConstructor": false,
        "stateMutability": "pure",
      })
    })

    it("ModifierInvocation", () => {
      var ast = parseNode("function foo(uint a) onlyOwner {}")
      assert.deepEqual(ast.modifiers[0], {
        "type": "ModifierInvocation",
        "name": "onlyOwner",
        "arguments": []
      })

      ast = parseNode("function foo(uint a) bar(true, 1) {}")
      assert.deepEqual(ast.modifiers[0], {
        "type": "ModifierInvocation",
        "name": "bar",
        "arguments": [
          {
            "type": "BooleanLiteral",
            "value": true
          },
          {
            "type": "NumberLiteral",
            "number": "1",
            "subdenomination": null
          },
        ]
      })
    })

    it("ElementaryTypeNameExpression", () => {
      var stmt = parseStatement("uint(a);")
      assert.deepEqual(stmt.expression.expression, {
        "type": "ElementaryTypeNameExpression",
        "typeName": {
          "type": "ElementaryTypeName",
          "name": "uint"
        }
      })
    })

    it("TypeName", () => {
      var ast = parseNode("uint256[2] a;")
      assert.deepEqual(ast.variables[0].typeName, {
        "type": "ArrayTypeName",
        "baseTypeName": {
          "type": "ElementaryTypeName",
          "name": "uint256"
        },
        "length": {
          "type": "NumberLiteral",
          "number": "2",
          "subdenomination": null
        }
      })
    })

    it("FunctionTypeName", () => {
      var ast = parseNode("function (uint, uint) returns(bool) a;")
      assert.deepEqual(ast.variables[0].typeName, {
        "type": "FunctionTypeName",
        "parameterTypes": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": null,
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          },
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": null,
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ],
        "returnTypes": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "bool"
            },
            "name": null,
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ],
        "visibility": "default",
        "stateMutability": null
      })
    })

    it("ReturnStatement", () => {
      var ast = parseStatement("return;")
      assert.deepEqual(ast, {
        "type": "ReturnStatement",
        "expression": null
      })

      ast = parseStatement("return 2;")
      assert.deepEqual(ast, {
        "type": "ReturnStatement",
        "expression": {
          "type": "NumberLiteral",
          "number": "2",
          "subdenomination": null
        }
      })
    })

    it("StructDefinition", () => {
      var ast = parseNode("struct hello { uint a; }")
      assert.deepEqual(ast, {
        "type": "StructDefinition",
        "name": "hello",
        "members": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ]
      })
    })

    it("VariableDeclaration", () => {
      // state variable
      var ast = parseNode("uint a;")
      assert.deepEqual(ast.variables[0], {
        "type": "VariableDeclaration",
        "typeName": {
          "type": "ElementaryTypeName",
          "name": "uint"
        },
        "name": "a",
        "expression": null,
        "visibility": "default",
        "isStateVar": true,
        "isDeclaredConst": false,
        "isIndexed": false
      })
    })

    it("WhileStatement", () => {
      var stmt = parseStatement("while (true) {}")
      assert.deepEqual(stmt, {
        "type": "WhileStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })

      stmt = parseStatement("do {} while (true);")
      assert.deepEqual(stmt, {
        "type": "DoWhileStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })
    })

    it("IfStatement", () => {
      var stmt = parseStatement("if (true) {}")
      assert.deepEqual(stmt, {
        "type": "IfStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "trueBody": {
          "type": "Block",
          "statements": []
        },
        "falseBody": null
      })

      // else
      stmt = parseStatement("if (true) {} else {}")
      assert.deepEqual(stmt, {
        "type": "IfStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "trueBody": {
          "type": "Block",
          "statements": []
        },
        "falseBody": {
          "type": "Block",
          "statements": []
        },
      })
    })

    it("UserDefinedTypeName", () => {
      var ast = parseStatement("Foo.Bar a;")
      assert.deepEqual(ast.variables[0].typeName, {
        "type": "UserDefinedTypeName",
        "namePath": "Foo.Bar"
      })
    })

    it("ExpressionStatement", () => {
      var stmt = parseStatement("true;")
      assert.deepEqual(stmt, {
        "type": "ExpressionStatement",
        "expression": {
          "type": "BooleanLiteral",
          "value": true
        }
      })
    })

    it("NumberLiteral", () => {
      var expr = parseExpression("2 ether")
      assert.deepEqual(expr, {
        "type": "NumberLiteral",
        "number": "2",
        "subdenomination": "ether"
      })
    })

    it("StringLiteral", () => {
      var expr = parseExpression("\"Hello\"")
      assert.deepEqual(expr, {
        "type": "StringLiteral",
        "value": "Hello",
      })
    })

    it("HexLiteral", () => {
      var expr = parseExpression("hex\"fafafa\"")
      assert.deepEqual(expr, {
        type: "HexLiteral",
        value: "hex\"fafafa\""
      })
    })

    it("BooleanLiteral", () => {
      var expr = parseExpression("false")
      assert.deepEqual(expr, {
        "type": "BooleanLiteral",
        "value": false,
      })
    })

    it("Mapping", () => {
      var ast = parseNode("mapping(uint => address) a;")
      assert.deepEqual(ast.variables[0].typeName, {
        "type": "Mapping",
        "keyType": {
          "type": "ElementaryTypeName",
          "name": "uint"
        },
        "valueType": {
          "type": "ElementaryTypeName",
          "name": "address"
        }
      })
    })

    it("ModifierDefinition", () => {
      var ast = parseNode("modifier onlyOwner {}")
      assert.deepEqual(ast, {
        "type": "ModifierDefinition",
        "name": "onlyOwner",
        "parameters": [],
        "body": {
          "type": "Block",
          "statements": []
        }
      })
    })

    it("Expression", () => {
      // new expression
      var expr = parseExpression("new MyContract")
      assert.deepEqual(expr, {
        "type": "NewExpression",
        "typeName": {
          "type": "UserDefinedTypeName",
          "namePath": "MyContract"
        }
      })

      // prefix operation
      var expr = parseExpression("!true")
      assert.deepEqual(expr, {
        "type": "UnaryOperation",
        "operator": "!",
        "subExpression": {
          "type": "BooleanLiteral",
          "value": true
        },
        "isPrefix": true
      })

      // prefix operation
      var expr = parseExpression("i++")
      assert.deepEqual(expr, {
        "type": "UnaryOperation",
        "operator": "++",
        "subExpression": {
          "type": "Identifier",
          "name": "i"
        },
        "isPrefix": false
      })
    })

    it("StateVariableDeclaration", () => {
      var ast = parseNode("uint a;")
      assert.deepEqual(ast, {
        "type": "StateVariableDeclaration",
        "variables": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "expression": null,
            "visibility": "default",
            "isStateVar": true,
            "isDeclaredConst": false,
            "isIndexed": false
          }
        ],
        "initialValue": null
      })
    })

    it("ForStatement", () => {
      var stmt = parseStatement("for (i = 0; i < 10; i++) {}")
      assert.deepEqual(stmt, {
        "type": "ForStatement",
        "initExpression": {
          "type": "ExpressionStatement",
          "expression": {
            "type": "BinaryOperation",
            "operator": "=",
            "left": {
              "type": "Identifier",
              "name": "i"
            },
            "right": {
              "type": "NumberLiteral",
              "number": "0",
              "subdenomination": null
            }
          }
        },
        "conditionExpression": {
          "type": "BinaryOperation",
          "operator": "<",
          "left": {
            "type": "Identifier",
            "name": "i"
          },
          "right": {
            "type": "NumberLiteral",
            "number": "10",
            "subdenomination": null
          }
        },
        "loopExpression": {
          "type": "ExpressionStatement",
          "expression": {
            "type": "UnaryOperation",
            "operator": "++",
            "subExpression": {
              "type": "Identifier",
              "name": "i"
            },
            "isPrefix": false
          }
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })

    })

    it("Identifier", () => {
      var expr = parseExpression("a")
      assert.deepEqual(expr, {
        "type": "Identifier",
        "name": "a",
      })
    })

    it("TupleExpression", () => {
      // tuple
      var ast = parseExpression("(a, b)")
      assert.deepEqual(ast, {
        "type": "TupleExpression",
        "elements": [
          {
            "type": "Identifier",
            "name": "a"
          },
          {
            "type": "Identifier",
            "name": "b"
          }
        ],
        "isArray": false
      })

      // array
      ast = parseExpression("[a, b]")
      assert.deepEqual(ast, {
        "type": "TupleExpression",
        "elements": [
          {
            "type": "Identifier",
            "name": "a"
          },
          {
            "type": "Identifier",
            "name": "b"
          }
        ],
        "isArray": true
      })
    })

    it("VariableDeclarationStatement", () => {
      var stmt = parseStatement("uint a;")
      assert.deepEqual(stmt, {
        "type": "VariableDeclarationStatement",
        "variables": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ],
        "initialValue": null
      })
    })

    it("ImportDirective", () => {
      var ast = parser.parse("import \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": null,
        "symbolAliases": null
      })

      ast = parser.parse("import \"./abc.sol\" as x;")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": "x",
        "symbolAliases": null
      })

      ast = parser.parse("import * as x from \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": "x",
        "symbolAliases": null
      })

      ast = parser.parse("import { a as b, c as d, f } from \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": null,
        "symbolAliases": [
          ["a", "b"],
          ["c", "d"],
          ["f", null],
        ]
      })
    })

    it("EventDefinition", () => {
      var ast = parseNode("event Foo(address indexed a, uint b);")
      assert.deepEqual(ast, {
        "type": "EventDefinition",
        "name": "Foo",
        "parameters": {
          "type": "ParameterList",
          "parameters": [
            {
              "type": "VariableDeclaration",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "address"
              },
              "name": "a",
              "isStateVar": false,
              "isIndexed": true
            },
            {
              "type": "VariableDeclaration",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "uint"
              },
              "name": "b",
              "isStateVar": false,
              "isIndexed": false
            }
          ]
        },
        "isAnonymous": false
      })
    })

    it("InlineAssemblyStatement", () => {
      var ast = parseStatement("assembly {}")
      assert.deepEqual(ast, {
        "type": "InlineAssemblyStatement",
        "language": null,
        "body": {
          "type": "AssemblyBlock",
          "operations": []
        }
      })

      ast = parseStatement("assembly \"evmasm\" {}")
      assert.deepEqual(ast, {
        "type": "InlineAssemblyStatement",
        "language": "evmasm",
        "body": {
          "type": "AssemblyBlock",
          "operations": []
        }
      })
    })

    it("AssemblyCall", () => {
      var ast = parseAssembly("mload(0x04)")
      assert.deepEqual(ast, {
        "type": "AssemblyCall",
        "functionName": "mload",
        "arguments": [
          {
            "type": "HexNumber",
            "value": "0x04"
          }
        ]
      })
    })

    it("AssemblyLiteral", () => {
      var ast = parseAssembly("0x04")
      assert.deepEqual(ast, {
        "type": "HexNumber",
        "value": "0x04"
      })

      ast = parseAssembly("\"hello\"")
      assert.deepEqual(ast, {
        "type": "StringLiteral",
        "value": "hello"
      })
    })

    it("AssemblySwitch / AssemblyCase", () => {
      var ast = parseAssembly("switch x case 0 { y := mul(x, 2) } default { y := 0 }")
      assert.deepEqual(ast, {
        "type": "AssemblySwitch",
        "expression": {
          "type": "AssemblyCall",
          "functionName": "x",
          "arguments": []
        },
        "cases": [
          {
            "type": "AssemblyCase",
            "block": {
              "type": "AssemblyBlock",
              "operations": [
                {
                  "type": "AssemblyAssignment",
                  "names": [
                    {
                      "type": "Identifier",
                      "name": "y"
                    }
                  ],
                  "expression": {
                    "type": "AssemblyCall",
                    "functionName": "mul",
                    "arguments": [
                      {
                        "type": "AssemblyCall",
                        "functionName": "x",
                        "arguments": []
                      },
                      {
                        "type": "DecimalNumber",
                        "value": "2"
                      }
                    ]
                  }
                }
              ]
            },
            "value": {
              "type": "DecimalNumber",
              "value": "0"
            }
          },
          {
            "type": "AssemblyCase",
            "block": {
              "type": "AssemblyBlock",
              "operations": [
                {
                  "type": "AssemblyAssignment",
                  "names": [
                    {
                      "type": "Identifier",
                      "name": "y"
                    }
                  ],
                  "expression": {
                    "type": "DecimalNumber",
                    "value": "0"
                  }
                }
              ]
            },
            "default": true
          }
        ]
      })
    })

    it("AssemblyLocalDefinition", () => {
      var ast = parseAssembly("let x := 0x04")
      assert.deepEqual(ast, {
        "type": "AssemblyLocalDefinition",
        "names": [
          {
            "type": "Identifier",
            "name": "x"
          }
        ],
        "expression": {
          "type": "HexNumber",
          "value": "0x04"
        }
      })

    })

    it("AssemblyFunctionDefinition", () => {
      var ast = parseAssembly("function power(base, exponent) -> result {}")
      assert.deepEqual(ast, {
        "type": "AssemblyFunctionDefinition",
        "name": "power",
        "arguments": [
          {
            "type": "Identifier",
            "name": "base"
          },
          {
            "type": "Identifier",
            "name": "exponent"
          }
        ],
        "returnArguments": [
          {
            "type": "Identifier",
            "name": "result"
          }
        ],
        "body": {
          "type": "AssemblyBlock",
          "operations": []
        }
      })


    })

    it("AssemblyAssignment", () => {
      var ast = parseAssembly("a := 10")
      assert.deepEqual(ast, {
        "type": "AssemblyAssignment",
        "names": [
          {
            "type": "Identifier",
            "name": "a"
          }
        ],
        "expression": {
          "type": "DecimalNumber",
          "value": "10"
        }
      })
    })

    it("LabelDefinition", () => {
      var ast = parseAssembly("loop:")
      assert.deepEqual(ast, {
        "type": "LabelDefinition",
        "name": "loop"
      })
    })

    it("AssemblyStackAssignment", () => {
      var ast = parseAssembly("=: a")
      assert.deepEqual(ast, {
        "type": "AssemblyStackAssignment",
        "name": "a"
      })
    })

    it("AssemblyFor", () => {
      var ast = parseAssembly("for { let i := 0  } lt(i, x) { i := add(i, 1)  } { y := mul(2, y) }")
      assert.deepEqual(ast, {
        "type": "AssemblyFor",
        "pre": {
          "type": "AssemblyBlock",
          "operations": [
            {
              "type": "AssemblyLocalDefinition",
              "names": [
                {
                  "type": "Identifier",
                  "name": "i"
                }
              ],
              "expression": {
                "type": "DecimalNumber",
                "value": "0"
              }
            }
          ]
        },
        "condition": {
          "type": "AssemblyCall",
          "functionName": "lt",
          "arguments": [
            {
              "type": "AssemblyCall",
              "functionName": "i",
              "arguments": []
            },
            {
              "type": "AssemblyCall",
              "functionName": "x",
              "arguments": []
            }
          ]
        },
        "post": {
          "type": "AssemblyBlock",
          "operations": [
            {
              "type": "AssemblyAssignment",
              "names": [
                {
                  "type": "Identifier",
                  "name": "i"
                }
              ],
              "expression": {
                "type": "AssemblyCall",
                "functionName": "add",
                "arguments": [
                  {
                    "type": "AssemblyCall",
                    "functionName": "i",
                    "arguments": []
                  },
                  {
                    "type": "DecimalNumber",
                    "value": "1"
                  }
                ]
              }
            }
          ]
        },
        "body": {
          "type": "AssemblyBlock",
          "operations": [
            {
              "type": "AssemblyAssignment",
              "names": [
                {
                  "type": "Identifier",
                  "name": "y"
                }
              ],
              "expression": {
                "type": "AssemblyCall",
                "functionName": "mul",
                "arguments": [
                  {
                    "type": "DecimalNumber",
                    "value": "2"
                  },
                  {
                    "type": "AssemblyCall",
                    "functionName": "y",
                    "arguments": []
                  }
                ]
              }
            }
          ]
        }
      })
    })
  })

  describe("node meta", () => {

    it("adds meta to VariableDeclaration inside StateVariableDeclaration", () => {
      var ast = parseNode("uint public a;", { loc: true })
      assert.isOk(ast.variables[0].loc)
    })

    it("adds meta to VariableDeclaration inside VariableDeclarationStatement", () => {
      var ast = parseStatement("uint a;", { loc: true })
      assert.isOk(ast.variables[0].loc)
    })

    it("adds meta to VariableDeclaration inside EventDefinition", () => {
      var ast = parseNode("event Foo(address bar);", { loc: true })
      assert.isOk(ast.parameters.parameters[0].loc)
    })

  })
})

describe("#visit", () => {

  it("walks visitor through AST", () => {
    var source = "contract test { uint a; }"
    var ast = parser.parse(source)
    parser.visit(ast, {
      ContractDefinition: (node) => {
        assert.equal(node.type, 'ContractDefinition')
      },

      'ContractDefinition:exit': (node) => {
        assert.equal(node.type, 'ContractDefinition')
      }
    })
  })

  it("can stop visiting inner nodes by returning false", () => {
    var source = "contract test { uint a; }"
    var ast = parser.parse(source)
    parser.visit(ast, {
      ContractDefinition: (node) => {
        return false
      },

      'ContractDefinition:exit': (node) => {
        assert.fail('should not reach here')
      }
    })
  })

})
