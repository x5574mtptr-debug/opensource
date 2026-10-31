export default function(global, globalThis, window, $app_exports$, $app_evaluate$) {
    var org_app_require = $app_require$;
    (function(global, globalThis, window, $app_exports$, $app_evaluate$) {
        var setTimeout = global.setTimeout;
        var setInterval = global.setInterval;
        var clearTimeout = global.clearTimeout;
        var clearInterval = global.clearInterval;
        var $app_require$1 = global.$app_require$ || org_app_require;
        var createPageHandler = function() {
            return (()=>{
                var __webpack_modules__ = {};
                var __webpack_module_cache__ = {};
                function __webpack_require__(moduleId) {
                    var cachedModule = __webpack_module_cache__[moduleId];
                    if (void 0 !== cachedModule) return cachedModule.exports;
                    var module = __webpack_module_cache__[moduleId] = {
                        exports: {}
                    };
                    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
                    return module.exports;
                }
                (()=>{
                    __webpack_require__.rv = ()=>"1.7.11";
                })();
                (()=>{
                    __webpack_require__.ruid = "bundler=rspack@1.7.11";
                })();
                var $app_style$ = [
                    [
                        [
                            [
                                0,
                                "demo-page"
                            ]
                        ],
                        {
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center"
                        }
                    ],
                    [
                        [
                            [
                                0,
                                "title"
                            ]
                        ],
                        {
                            fontSize: "40px",
                            textAlign: "center",
                            color: "#ffffff",
                            marginTop: "42px"
                        }
                    ],
                    [
                        [
                            [
                                0,
                                "list"
                            ]
                        ],
                        {
                            width: "100%",
                            height: "100%"
                        }
                    ],
                    [
                        [
                            [
                                0,
                                "list-item"
                            ]
                        ],
                        {
                            flexDirection: "row",
                            alignItems: "center",
                            height: "88px"
                        }
                    ],
                    [
                        [
                            [
                                0,
                                "subject-image"
                            ]
                        ],
                        {
                            width: "60px",
                            height: "60px",
                            marginRight: "30px"
                        }
                    ],
                    [
                        [
                            [
                                0,
                                "subject-name"
                            ]
                        ],
                        {
                            fontSize: "36px",
                            fontWeight: 400,
                            color: "#ffffff"
                        }
                    ]
                ];
                var $app_script$ = function __scriptModule__(module, exports, $app_require$1) {
                    "use strict";
                    Object.defineProperty(exports, "__esModule", {
                        value: true
                    });
                    exports.default = void 0;
                    var _system = _interopRequireDefault($app_require$1("@app-module/system.router"));
                    var _system2 = _interopRequireDefault($app_require$1("@app-module/system.app"));
                    function _interopRequireDefault(e) {
                        return e && e.__esModule ? e : {
                            default: e
                        };
                    }
                    var _default = exports.default = {
                        private: {
                            title: "示例页面",
                            list: [
                                {
                                    name: "显示与亮度",
                                    iconSrc: "/common/image/display.indexed_8.png"
                                },
                                {
                                    name: "应用视图",
                                    iconSrc: "/common/image/applayout.indexed_8.png"
                                },
                                {
                                    name: "蓝牙与连接",
                                    iconSrc: "/common/image/bluetooth.indexed_8.png"
                                },
                                {
                                    name: "移动网络",
                                    iconSrc: "/common/image/wlan.indexed_8.png"
                                },
                                {
                                    name: "声音与振动",
                                    iconSrc: "/common/image/display.indexed_8.png"
                                },
                                {
                                    name: "专注模式",
                                    iconSrc: "/common/image/disturb.indexed_8.png"
                                },
                                {
                                    name: "运动",
                                    iconSrc: "/common/image/motion.indexed_8.png"
                                },
                                {
                                    name: "健康",
                                    iconSrc: "/common/image/downkey.indexed_8.png"
                                },
                                {
                                    name: "心率广播",
                                    iconSrc: "/common/image/applayout.indexed_8.png"
                                },
                                {
                                    name: "体感手势",
                                    iconSrc: "/common/image/guesture.indexed_8.png"
                                },
                                {
                                    name: "快捷与帮助",
                                    iconSrc: "/common/image/novice.indexed_8.png"
                                },
                                {
                                    name: "密码",
                                    iconSrc: "/common/image/wrist.indexed_8.png"
                                },
                                {
                                    name: "隐私与安全",
                                    iconSrc: "/common/image/wrist.indexed_8.png"
                                },
                                {
                                    name: "系统管理",
                                    iconSrc: "/common/image/system.indexed_8.png"
                                },
                                {
                                    name: "关于手表",
                                    iconSrc: "/common/image/about.indexed_8.png"
                                }
                            ]
                        },
                        routeDetail () {
                            _system.default.push({
                                uri: "/pages/detail"
                            });
                        },
                        handleClick () {
                            _system2.default.terminate();
                        }
                    };
                    const moduleOwn = exports.default || module.exports;
                    const accessors = [
                        'public',
                        'protected',
                        'private'
                    ];
                    if (moduleOwn.data && accessors.some(function(acc) {
                        return moduleOwn[acc];
                    })) throw new Error('页面VM对象中的属性data不可与"' + accessors.join(',') + '"同时存在，请使用private替换data名称');
                    if (!moduleOwn.data) {
                        moduleOwn.data = {};
                        moduleOwn._descriptor = {};
                        accessors.forEach(function(acc) {
                            const accType = typeof moduleOwn[acc];
                            if ('object' === accType) {
                                moduleOwn.data = Object.assign(moduleOwn.data, moduleOwn[acc]);
                                for(const name in moduleOwn[acc])moduleOwn._descriptor[name] = {
                                    access: acc
                                };
                            } else if ('function' === accType) console.warn('页面VM对象中的属性' + acc + '的值不能是函数，请使用对象');
                        });
                    }
                };
                var $app_template$ = function(vm) {
                    const _vm_ = vm || this;
                    return aiot.__ce__("div", {
                        __vm__: _vm_,
                        __opts__: {
                            classList: [
                                "w-full",
                                "h-full",
                                "bg-black"
                            ]
                        }
                    }, [
                        aiot.__ce__("list", {
                            __vm__: _vm_,
                            __opts__: {
                                classList: [
                                    "list"
                                ]
                            }
                        }, [
                            aiot.__ce__("list-item", {
                                __vm__: _vm_,
                                __opts__: {
                                    classList: [
                                        "list-item",
                                        "justify-center"
                                    ],
                                    type: "title"
                                }
                            }, [
                                aiot.__ce__("image", {
                                    __vm__: _vm_,
                                    __opts__: {
                                        classList: [
                                            "w-30",
                                            "h-30",
                                            "mr-10"
                                        ],
                                        src: "/common/image/back.png",
                                        events: {
                                            click: function(evt) {
                                                return _vm_.handleClick(evt);
                                            }
                                        }
                                    }
                                }, []),
                                aiot.__ce__("text", {
                                    __vm__: _vm_,
                                    __opts__: {
                                        classList: [
                                            "fs-36"
                                        ],
                                        value: "设置"
                                    }
                                }, [])
                            ]),
                            aiot.__cf__({
                                __vm__: _vm_,
                                __opts__: {
                                    exp: function() {
                                        return _vm_.list;
                                    },
                                    key: "$idx",
                                    value: "$item"
                                }
                            }, function($idx, $item) {
                                return [
                                    aiot.__ce__("list-item", {
                                        __vm__: _vm_,
                                        __opts__: {
                                            classList: [
                                                "list-item",
                                                "justify-between",
                                                "pl-60"
                                            ],
                                            type: "setting-item"
                                        }
                                    }, [
                                        aiot.__ce__("div", {
                                            __vm__: _vm_,
                                            __opts__: {}
                                        }, [
                                            aiot.__ce__("image", {
                                                __vm__: _vm_,
                                                __opts__: {
                                                    classList: [
                                                        "subject-image",
                                                        "mt-4"
                                                    ],
                                                    src: function() {
                                                        return $item.iconSrc;
                                                    }
                                                }
                                            }, []),
                                            aiot.__ce__("text", {
                                                __vm__: _vm_,
                                                __opts__: {
                                                    classList: [
                                                        "subject-name"
                                                    ],
                                                    value: function() {
                                                        return $item.name;
                                                    }
                                                }
                                            }, [])
                                        ]),
                                        aiot.__ce__("image", {
                                            __vm__: _vm_,
                                            __opts__: {
                                                classList: [
                                                    "subject-image",
                                                    "mr-60"
                                                ],
                                                src: "/common/image/right.png"
                                            }
                                        }, [])
                                    ])
                                ];
                            })
                        ])
                    ]);
                };
                $app_exports$['entry'] = function($app_exports$) {
                    $app_script$({}, $app_exports$, $app_require$1);
                    $app_exports$.default.template = $app_template$;
                    $app_exports$.default.style = $app_style$;
                };
            })();
        };
        return createPageHandler();
    })(global, globalThis, window, $app_exports$, $app_evaluate$);
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZXNcXGhvbWVcXGluZGV4LmpzIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGVzdC93ZWJwYWNrL3J1bnRpbWUvcnNwYWNrX3ZlcnNpb24iLCJ3ZWJwYWNrOi8vdGVzdC93ZWJwYWNrL3J1bnRpbWUvcnNwYWNrX3VuaXF1ZV9pZCIsIndlYnBhY2s6Ly90ZXN0L3NyYy9wYWdlcy9ob21lL2luZGV4LnV4Il0sInNvdXJjZXNDb250ZW50IjpbIl9fd2VicGFja19yZXF1aXJlX18ucnYgPSAoKSA9PiAoXCIxLjcuMTFcIikiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLnJ1aWQgPSBcImJ1bmRsZXI9cnNwYWNrQDEuNy4xMVwiOyIsIjx0ZW1wbGF0ZT5cbiAgPGRpdiBjbGFzcz1cInctZnVsbCBoLWZ1bGwgYmctYmxhY2tcIj5cbiAgICA8bGlzdCBjbGFzcz1cImxpc3RcIj5cbiAgICAgIDxsaXN0LWl0ZW0gY2xhc3M9XCJsaXN0LWl0ZW0ganVzdGlmeS1jZW50ZXJcIiB0eXBlPVwidGl0bGVcIj5cbiAgICAgICAgPGltYWdlIGNsYXNzPVwidy0zMCBoLTMwIG1yLTEwXCIgc3JjPVwiL2NvbW1vbi9pbWFnZS9iYWNrLnBuZ1wiIG9uY2xpY2s9XCJoYW5kbGVDbGlja1wiPjwvaW1hZ2U+XG4gICAgICAgIDx0ZXh0IGNsYXNzPVwiZnMtMzZcIj7orr7nva48L3RleHQ+XG4gICAgICA8L2xpc3QtaXRlbT5cbiAgICAgIDxsaXN0LWl0ZW0gY2xhc3M9XCJsaXN0LWl0ZW0ganVzdGlmeS1iZXR3ZWVuIHBsLTYwXCIgdHlwZT1cInNldHRpbmctaXRlbVwiIGZvcj1cInt7bGlzdH19XCI+XG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgPGltYWdlIGNsYXNzPVwic3ViamVjdC1pbWFnZSBtdC00XCIgc3JjPVwie3skaXRlbS5pY29uU3JjfX1cIj48L2ltYWdlPlxuICAgICAgICAgIDx0ZXh0IGNsYXNzPVwic3ViamVjdC1uYW1lXCI+e3sgJGl0ZW0ubmFtZSB9fTwvdGV4dD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGltYWdlIGNsYXNzPVwic3ViamVjdC1pbWFnZSBtci02MFwiIHNyYz1cIi9jb21tb24vaW1hZ2UvcmlnaHQucG5nXCI+PC9pbWFnZT5cbiAgICAgIDwvbGlzdC1pdGVtPlxuICAgIDwvbGlzdD5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0PlxuaW1wb3J0IHJvdXRlciBmcm9tIFwiQHN5c3RlbS5yb3V0ZXJcIlxuaW1wb3J0IGFwcCBmcm9tIFwiQHN5c3RlbS5hcHBcIlxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8vIOmhtemdoue6p+e7hOS7tueahOaVsOaNruaooeWei++8jOW9seWTjeS8oOWFpeaVsOaNrueahOimhuebluacuuWItu+8mnByaXZhdGXlhoXlrprkuYnnmoTlsZ7mgKfkuI3lhYHorrjooqvopobnm5ZcbiAgcHJpdmF0ZToge1xuICAgIHRpdGxlOiBcIuekuuS+i+mhtemdolwiLFxuICAgIGxpc3Q6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLmmL7npLrkuI7kuq7luqZcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL2Rpc3BsYXkuaW5kZXhlZF84LnBuZ1wiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIuW6lOeUqOinhuWbvlwiLFxuICAgICAgICBpY29uU3JjOiBcIi9jb21tb24vaW1hZ2UvYXBwbGF5b3V0LmluZGV4ZWRfOC5wbmdcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLok53niZnkuI7ov57mjqVcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL2JsdWV0b290aC5pbmRleGVkXzgucG5nXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwi56e75Yqo572R57ucXCIsXG4gICAgICAgIGljb25TcmM6IFwiL2NvbW1vbi9pbWFnZS93bGFuLmluZGV4ZWRfOC5wbmdcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLlo7Dpn7PkuI7mjK/liqhcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL2Rpc3BsYXkuaW5kZXhlZF84LnBuZ1wiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIuS4k+azqOaooeW8j1wiLFxuICAgICAgICBpY29uU3JjOiBcIi9jb21tb24vaW1hZ2UvZGlzdHVyYi5pbmRleGVkXzgucG5nXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwi6L+Q5YqoXCIsXG4gICAgICAgIGljb25TcmM6IFwiL2NvbW1vbi9pbWFnZS9tb3Rpb24uaW5kZXhlZF84LnBuZ1wiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIuWBpeW6t1wiLFxuICAgICAgICBpY29uU3JjOiBcIi9jb21tb24vaW1hZ2UvZG93bmtleS5pbmRleGVkXzgucG5nXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwi5b+D546H5bm/5pKtXCIsXG4gICAgICAgIGljb25TcmM6IFwiL2NvbW1vbi9pbWFnZS9hcHBsYXlvdXQuaW5kZXhlZF84LnBuZ1wiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIuS9k+aEn+aJi+WKv1wiLFxuICAgICAgICBpY29uU3JjOiBcIi9jb21tb24vaW1hZ2UvZ3Vlc3R1cmUuaW5kZXhlZF84LnBuZ1wiXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIuW/q+aNt+S4juW4ruWKqVwiLFxuICAgICAgICBpY29uU3JjOiBcIi9jb21tb24vaW1hZ2Uvbm92aWNlLmluZGV4ZWRfOC5wbmdcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLlr4bnoIFcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL3dyaXN0LmluZGV4ZWRfOC5wbmdcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLpmpDnp4HkuI7lronlhahcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL3dyaXN0LmluZGV4ZWRfOC5wbmdcIlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCLns7vnu5/nrqHnkIZcIixcbiAgICAgICAgaWNvblNyYzogXCIvY29tbW9uL2ltYWdlL3N5c3RlbS5pbmRleGVkXzgucG5nXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwi5YWz5LqO5omL6KGoXCIsXG4gICAgICAgIGljb25TcmM6IFwiL2NvbW1vbi9pbWFnZS9hYm91dC5pbmRleGVkXzgucG5nXCJcbiAgICAgIH1cbiAgICBdXG4gIH0sXG5cbiAgcm91dGVEZXRhaWwoKSB7XG4gICAgLy8g6Lez6L2s5Yiw5bqU55So5YaF55qE5p+Q5Liq6aG16Z2i77yMcm91dGVy55So5rOV6K+m6KeB77ya5paH5qGjLT7mjqXlj6MtPumhtemdoui3r+eUsVxuICAgIHJvdXRlci5wdXNoKHtcbiAgICAgIHVyaTogXCIvcGFnZXMvZGV0YWlsXCJcbiAgICB9KVxuICB9LFxuICBoYW5kbGVDbGljaygpIHtcbiAgICBhcHAudGVybWluYXRlKClcbiAgfVxufVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbkBpbXBvcnQgXCIuL2luZGV4Lmxlc3NcIjtcbi5saXN0IHtcbiAgd2lkdGg6IDEwMCU7XG4gIGhlaWdodDogMTAwJTtcbn1cbi50aXRsZSB7XG4gIGNvbG9yOiAjZmZmO1xuICBmb250LXNpemU6IDQwcHg7XG4gIG1hcmdpbi10b3A6IDQycHg7XG59XG4ubGlzdC1pdGVtIHtcbiAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgaGVpZ2h0OiA4OHB4O1xufVxuXG4uc3ViamVjdC1pbWFnZSB7XG5cdHdpZHRoOiA2MHB4O1xuXHRoZWlnaHQ6IDYwcHg7XG5cdG1hcmdpbi1yaWdodDogMzBweDtcbn1cbi5zdWJqZWN0LW5hbWUge1xuXHRmb250LXNpemU6IDM2cHg7XG5cdGZvbnQtd2VpZ2h0OiA0MDA7XG5cdGNvbG9yOiAjZmZmO1xufVxuPC9zdHlsZT4iXSwibmFtZXMiOlsiX193ZWJwYWNrX3JlcXVpcmVfXyIsIl9zeXN0ZW0iLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiJGFwcF9yZXF1aXJlJCIsIl9zeXN0ZW0yIiwiZSIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiX2RlZmF1bHQiLCJleHBvcnRzIiwicHJpdmF0ZSIsInRpdGxlIiwibGlzdCIsIm5hbWUiLCJpY29uU3JjIiwicm91dGVEZXRhaWwiLCJyb3V0ZXIiLCJwdXNoIiwidXJpIiwiaGFuZGxlQ2xpY2siLCJhcHAiLCJ0ZXJtaW5hdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7b0JBQUFBLG9CQUFvQixFQUFFLEdBQUcsSUFBTzs7O29CQ0FoQ0Esb0JBQW9CLElBQUksR0FBRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztvQkNvQjNCLElBQUFDLFVBQUFDLHVCQUFBQyxlQUFBO29CQUNBLElBQUFDLFdBQUFGLHVCQUFBQyxlQUFBO29CQUE2QixTQUFBRCx1QkFBQUcsQ0FBQTt3QkFBQSxPQUFBQSxLQUFBQSxFQUFBQyxVQUFBLEdBQUFELElBQUE7NEJBQUFFLFNBQUFGO3dCQUFBO29CQUFBO29CQUFBLElBQUFHLFdBQUFDLFFBQUFGLE9BQUEsR0FFZDt3QkFFYkcsU0FBUzs0QkFDUEMsT0FBTzs0QkFDUEMsTUFBTTtnQ0FDSjtvQ0FDRUMsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDtnQ0FDQTtvQ0FDRUQsTUFBTTtvQ0FDTkMsU0FBUztnQ0FDWDs2QkFBQzt3QkFFTDt3QkFFQUM7NEJBRUVDLFFBQUFBLE9BQU0sQ0FBQ0MsSUFBSSxDQUFDO2dDQUNWQyxLQUFLOzRCQUNQO3dCQUNGO3dCQUNBQzs0QkFDRUMsU0FBQUEsT0FBRyxDQUFDQyxTQUFTO3dCQUNmO29CQUNGIn0=