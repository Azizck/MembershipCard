(function (global) {
    'use strict';
    var LOG_LEVEL = {
      ALL: parseInt('11111',2),
      DEBUG: parseInt('00001',2),
      LOG: parseInt('00010',2),
      INFO: parseInt('00100',2),
      WARN: parseInt('01000',2),
      ERROR: parseInt('10000',2), 
      NONE: parseInt('00000',2)
    };
    
    var logLevel = LOG_LEVEL.LOG;
    
    var konsole = {
      debug: function() {
        logLevel <= LOG_LEVEL.DEBUG && console.debug.apply(console, arguments);
      },
      log: function() {
        logLevel <= LOG_LEVEL.LOG  && console.log.apply(console, arguments);
      },
      info: function() {
        logLevel <= LOG_LEVEL.INFO  && console.log.apply(console, arguments);
      },
      warn: function() {
        logLevel <= LOG_LEVEL.WARN && console.error.apply(console, arguments);
      },
      error: function() {
        logLevel <= LOG_LEVEL.ERROR && console.error.apply(console, arguments);
      },
    };
    
    konsole.debug(LOG_LEVEL);


    var util = newUtil();
    var inliner = newInliner();
    var fontFaces = newFontFaces();
    var images = newImages();

    global.domtoimage = {
        toSvg: toSvg,
        toPng: toPng,
        toBlob: toBlob,
        impl: {
            fontFaces: fontFaces,
            images: images,
            util: util,
            inliner: inliner
        }
    };

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options
     * @param {Function} options.filter - Should return true if passed node should be included in the output
     *          (excluding node means excluding it's children as well). Filter is not applied to the root node.
     * @param {String} options.bgcolor - color for the background, any valid CSS color value
     * @return {Promise} - A promise that is fulfilled with a SVG image data URL
     * */
    function toSvg(node, options) {
        konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #toSvg');
        options = options || {};
        return Promise.resolve(node)
            .then(function (node) {
                konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #toSvg');
                return cloneNode(node, options.filter, true);
            })
            .then( function (node) {
                konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #embedFonts');
                return fontFaces.resolveAll()
                    .then(function (cssText) {
                        var styleNode = document.createElement('style');
                        node.appendChild(styleNode);
                        styleNode.appendChild(document.createTextNode(cssText));
                        return node;
                    });
            })
            .then(function (node) {
                konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #inlineImages');
                return images.inlineAll(node)
                    .then(function(result) {
                        return node;
                    })
            })
            .then(function (clone) {
                konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> applying options');
                if (options.bgcolor) clone.style.backgroundColor = options.bgcolor;
                return clone;
            })
            .then(function (clone) {
                konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #makeSvgDataUri');
                return makeSvgDataUri(clone, node.scrollWidth, node.scrollHeight);
            });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image data URL
     * */
    function toPng(node, options) {
        konsole.debug('#toPng');

        return draw(node, options || {});
        //return draw(node, options || {})
        //    .then(function (canvas) {
        //        konsole.debug('#toPng', 'draw', canvas);
        //        var canvasOrDataUrl;
        //        try {
        //          canvasOrDataUrl = canvas.toDataURL(); 
        //        } catch(e) {
        //          canvasOrDataUrl = canvas;
        //        }
        //        return canvasOrDataUrl;
        //    });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image blob
     * */
    function toBlob(node, options) {
              konsole.debug('#toBlob');

        return draw(node, options || {})
            .then(util.canvasToBlob);
    }

    function cloneNode(node, filter, root) {
              konsole.debug('#cloneNode');

        if (!root && filter && !filter(node)) return Promise.resolve();

        return Promise.resolve(node)
            .then(makeNodeCopy)
            .then(function (clone) {
                return cloneChildren(node, clone, filter);
            })
            .then(function (clone) {
                return processClone(node, clone);
            });

        function makeNodeCopy(node) {
            konsole.debug('#cloneNode #makeNodeCopy');
      
            if (node instanceof HTMLCanvasElement) return util.makeImage(node.toDataURL());
            return node.cloneNode(false);
        }

        function cloneChildren(original, clone, filter) {
            konsole.debug('#cloneNode #makeNodeCopy');

            var children = original.childNodes;
            if (children.length === 0) return Promise.resolve(clone);

            return cloneChildrenInOrder(clone, util.asArray(children), filter)
                .then(function () {
                    return clone;
                });

            function cloneChildrenInOrder(parent, children, filter) {
              konsole.debug('#cloneNode #cloneChikdrenInOrder');

                var done = Promise.resolve();
                children.forEach(function (child) {
                    done = done
                        .then(function () {
                            return cloneNode(child, filter);
                        })
                        .then(function (childClone) {
                            if (childClone) parent.appendChild(childClone);
                        });
                });
                return done;
            }
        }

        function processClone(original, clone) {
            konsole.debug('#cloneNode #processClone');

            if (!(clone instanceof Element)) return clone;

            return Promise.resolve()
                .then(cloneStyle)
                .then(clonePseudoElements)
                .then(copyUserInput)
                .then(fixSvg)
                .then(function () {
                    return clone;
                });

            function cloneStyle() {
              konsole.debug('#cloneNode #processClone #cloneStyle');
                copyStyle(global.window.getComputedStyle(original), clone.style);

                function copyStyle(source, target) {
                  konsole.debug('#copyStyle');
                    if (source.cssText) target.cssText = source.cssText;
                    else copyProperties(source, target);

                    function copyProperties(source, target) {
                        util.asArray(source).forEach(function (name) {
                            target.setProperty(
                                name,
                                source.getPropertyValue(name),
                                source.getPropertyPriority(name)
                            );
                        });
                    }
                }
            }

            function clonePseudoElements() {
                konsole.debug('#cloneNode #processClone #clonePseudoElements');
                [':before', ':after'].forEach(function (element) {
                    clonePseudoElement(element);
                });

                function clonePseudoElement(element) {
                    konsole.debug('#cloneNode #processClone #clonePseudoElements #clonePseudoElement');
                    var style = global.window.getComputedStyle(original, element);
                    var content = style.getPropertyValue('content');

                    if (content === '' || content === 'none') return;

                    var className = util.uid();
                    clone.className = clone.className + ' ' + className;
                    var styleElement = global.document.createElement('style');
                    styleElement.appendChild(formatPseudoElementStyle(className, element, style));
                    clone.appendChild(styleElement);

                    function formatPseudoElementStyle(className, element, style) {
                        konsole.debug('#cloneNode #processClone #clonePseudoElements #formatPseudoElementStyle');
                        var selector = '.' + className + ':' + element;
                        var cssText = style.cssText ? formatCssText(style) : formatCssProperties(style);
                        return global.document.createTextNode(selector + '{' + cssText + '}');

                        function formatCssText(style) {
                            konsole.debug('#cloneNode #processClone #clonePseudoElements #formatPseudoElementStyle #formatCssText');
                            var content = style.getPropertyValue('content');
                            return style.cssText + ' content: ' + content + ';';
                        }

                        function formatCssProperties(style) {
                            konsole.debug('#cloneNode #processClone #clonePseudoElements #formatPseudoElementStyle #formatCssProperties');

                            return util.asArray(style)
                                .map(formatProperty)
                                .join('; ') + ';';

                            function formatProperty(name) {
                                return name + ': ' +
                                    style.getPropertyValue(name) +
                                    (style.getPropertyPriority(name) ? ' !important' : '');
                            }
                        }
                    }
                }
            }

            function copyUserInput() {
                konsole.debug('#cloneNode #processClone #clonePseudoElements #copyUserInput');
                if (original instanceof HTMLTextAreaElement) clone.innerHTML = original.value;
                if (original instanceof HTMLInputElement) clone.setAttribute("value", original.value);
            }

            function fixSvg() {
                konsole.debug('#cloneNode #processClone #clonePseudoElements #fixSvg');
                if (!(clone instanceof SVGElement)) return;
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                if (!(clone instanceof SVGRectElement)) return;
                ['width', 'height'].forEach(function (attribute) {
                    var value = clone.getAttribute(attribute);
                    if (!value) return;

                    clone.style.setProperty(attribute, value);
                });
            }
        }
    }

    function embedFonts(node) {
        konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #embedFonts');
        return fontFaces.resolveAll()
            .then(function (cssText) {
                var styleNode = document.createElement('style');
                node.appendChild(styleNode);
                styleNode.appendChild(document.createTextNode(cssText));
                return node;
            });
    }

    function inlineImages(node) {
        konsole.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> #inlineImages');
        return images.inlineAll(node)
            .then(function () {
                return node;
            });
    }

    function makeSvgDataUri(node, width, height) {
        konsole.debug('#makeSvgDataUri');
        return Promise.resolve(node)
            .then(function (node) {
                node.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                return new XMLSerializer().serializeToString(node);
            })
            .then(util.escapeXhtml)
            .then(function (xhtml) {
                konsole.debug('#makeSvgDataUri', 'xhtml');
                return '<foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject>';
            })
            .then(function (foreignObject) {
                konsole.debug('#makeSvgDataUri', 'foreignObject');
                return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
                    foreignObject + '</svg>';
            })
            .then(function (svg) {
              konsole.debug('#makeSvgDataUri', 'svg');
              return 'data:image/svg+xml;charset=utf-8,' + svg;
            });
    }

    function draw(domNode, options) {
        konsole.debug('#draw');
        return toSvg(domNode, options)
            .then(util.makeImage);
            //.then(util.delay(100))
            //.then(function (image) {
            //    konsole.debug('#draw', 'image', image)
            //    var canvas = newCanvas(domNode);
            //    canvas.getContext('2d').drawImage(image, 0, 0);
            //    konsole.debug('#draw', 'image done');
            //    return canvas;
            //});

        function newCanvas(domNode) {
            konsole.debug('#draw #newCanvas');
            try {
              var canvas = document.createElement('canvas');
              canvas.width = domNode.scrollWidth;
              canvas.height = domNode.scrollHeight;
            } catch(e) {
              konsole.debug(e, e.stack);
            }
            return canvas;
        }
    }

    function newUtil() {
        konsole.debug('#newUtil');
        return {
            escape: escape,
            parseExtension: parseExtension,
            mimeType: mimeType,
            dataAsUrl: dataAsUrl,
            isDataUrl: isDataUrl,
            canvasToBlob: canvasToBlob,
            resolveUrl: resolveUrl,
            getAndEncode: getAndEncode,
            uid: uid(),
            delay: delay,
            asArray: asArray,
            escapeXhtml: escapeXhtml,
            makeImage: makeImage
        };

        function mimes() {
            konsole.debug('#newUtil #mimes');

            /*
             * Only WOFF and EOT mime types for fonts are 'real'
             * see http://www.iana.org/assignments/media-types/media-types.xhtml
             */
            var WOFF = 'application/font-woff';
            var JPEG = 'image/jpeg';

            return {
                'woff': WOFF,
                'woff2': WOFF,
                'ttf': 'application/font-truetype',
                'eot': 'application/vnd.ms-fontobject',
                'png': 'image/png',
                'jpg': JPEG,
                'jpeg': JPEG,
                'gif': 'image/gif',
                'tiff': 'image/tiff',
                'svg': 'image/svg+xml'
            };
        }

        function parseExtension(url) {
            konsole.debug('#newUtil #parseExtension');
            var match = /\.([^\.\/]*?)$/g.exec(url);
            if (match) return match[1];
            else return '';
        }

        function mimeType(url) {
            konsole.debug('#newUtil #mimeType');
            var extension = parseExtension(url).toLowerCase();
            return mimes()[extension] || '';
        }

        function isDataUrl(url) {
            konsole.debug('#isDataUrl');
            return url.search(/^(data:)/) !== -1;
        }

        function toBlob(canvas) {
            konsole.debug('#newUtil #toBlob');
            return new Promise(function (resolve) {
                var binaryString = window.atob(canvas.toDataURL().split(',')[1]);
                var length = binaryString.length;
                var binaryArray = new Uint8Array(length);

                for (var i = 0; i < length; i++)
                    binaryArray[i] = binaryString.charCodeAt(i);

                resolve(new Blob([binaryArray], {
                    type: 'image/png'
                }));
            });
        }

        function canvasToBlob(canvas) {
            konsole.debug('#newUtil #canvasToBlob');
            if (canvas.toBlob)
                return new Promise(function (resolve) {
                    canvas.toBlob(resolve);
                });

            return toBlob(canvas);
        }

        function resolveUrl(url, baseUrl) {
            konsole.debug('#newUtil #resolveUrl');
            var doc = global.document.implementation.createHTMLDocument();
            var base = doc.createElement('base');
            doc.head.appendChild(base);
            var a = doc.createElement('a');
            doc.body.appendChild(a);
            base.href = baseUrl;
            a.href = url;
            return a.href;
        }

        function uid() {
            konsole.debug('#newUtil #uid');
            var index = 0;

            return function () {
                return 'u' + fourRandomChars() + index++;

                function fourRandomChars() {
                    /* see http://stackoverflow.com/a/6248722/2519373 */
                    return ('0000' + (Math.random() * Math.pow(36, 4) << 0).toString(36)).slice(-4);
                }
            };
        }

        function makeImage(uri) {
            konsole.debug('#newUtil #makeImage');
            return new Promise(function (resolve, reject) {
                konsole.debug('#makeImage', 'new Promise')
                var image = new Image();
                image.onload = function () {
                    konsole.debug('#makeImage', 'image.onload')
                    resolve(image);
                };
                image.onerror = function(e) {
                  konsole.debug('#makeImage image.onerror', e)
                  reject();
                }
                image.src = uri;
            });
        }

        function getAndEncode(url) {
            konsole.debug('#newUtil #getAndEncode', url);
            var TIMEOUT = 30000;

            return new Promise(function (resolve, reject) {
                var request = new XMLHttpRequest();

                request.onreadystatechange = done;
                request.ontimeout = timeout;
                request.responseType = 'blob';
                request.timeout = TIMEOUT;
                request.open('GET', url, true);
                request.send();

                function done() {
                    konsole.debug('#newUtil #getAndEncode #done');
                    if (request.readyState !== 4) return;

                    if (request.status !== 200) {
                        konsole.error('cannot fetch resource ' + url + ', status: ' + request.status);
                        resolve('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
                        return;
                    }

                    var encoder = new FileReader();
                    encoder.onloadend = function () {
                        var content = encoder.result.split(/,/)[1];
                        resolve(content);
                    };
                    encoder.readAsDataURL(request.response);
                }

                function timeout() {
                    konsole.debug('#newUtil #getAndEncode #timeout');
                    reject(new Error('Timeout of ' + TIMEOUT + 'ms occured while fetching resource: ' + url));
                }
            });
        }

        function dataAsUrl(content, type) {
            konsole.debug('#newUtil #dataAsUrl');
            return 'data:' + type + ';base64,' + content;
        }

        function escape(string) {
            konsole.debug('#newUtil #escape');
            return string.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1');
        }

        function delay(ms) {
            konsole.debug('#newUtil #delay');
            return function (arg) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(arg);
                    }, ms);
                });
            };
        }

        function asArray(arrayLike) {
            konsole.debug('#newUtil #asArray');
            var array = [];
            var length = arrayLike.length;
            for (var i = 0; i < length; i++) array.push(arrayLike[i]);
            return array;
        }

        function escapeXhtml(string) {
            konsole.debug('#newUtil #escapeXhtml');
            return string.replace(/#/g, '%23').replace(/\n/g, '%0A');
        }
    }

    function newInliner() {
        konsole.debug('#newUtil #newInliner');
        var URL_REGEX = /url\(['"]?([^'"]+?)['"]?\)/g;

        return {
            inlineAll: inlineAll,
            shouldProcess: shouldProcess,
            impl: {
                readUrls: readUrls,
                inline: inline
            }
        };

        function shouldProcess(string) {
            konsole.debug('#newUtil #newInliner #shouldProcess');
            return string.search(URL_REGEX) !== -1;
        }

        function readUrls(string) {
            konsole.debug('#newUtil #newInliner  #readUrls');
            var result = [];
            var match;
            while ((match = URL_REGEX.exec(string)) !== null) {
                result.push(match[1]);
            }
            return result.filter(function (url) {
                return !util.isDataUrl(url);
            });
        }

        function inline(string, url, baseUrl, get) {
            konsole.debug('#newUtil #newInliner #inline');
            return Promise.resolve(url)
                .then(function (url) {
                    konsole.debug('#newUtil #newInliner #inline', 'url', url);
                    return baseUrl ? util.resolveUrl(url, baseUrl) : url;
                })
                .then(get || util.getAndEncode)
                .then(function (data) {
                    konsole.debug('#newUtil #newInliner #inline', 'data', data);
                    return util.dataAsUrl(data, util.mimeType(url));
                })
                .then(function (dataUrl) {
                    konsole.debug('#newUtil #newInliner #inline', 'data', dataUrl);
                    return string.replace(urlAsRegex(url), '$1' + dataUrl + '$3');
                });

            function urlAsRegex(url) {
                return new RegExp('(url\\([\'"]?)(' + util.escape(url) + ')([\'"]?\\))', 'g');
            }
        }

        function inlineAll(string, baseUrl, get) {
            konsole.debug('#newUtil #newInliner #inlineAll');
            if (nothingToInline()) return Promise.resolve(string);

            return Promise.resolve(string)
                .then(readUrls)
                .then(function (urls) {
                    var done = Promise.resolve(string);
                    urls.forEach(function (url) {
                        done = done.then(function (string) {
                            return inline(string, url, baseUrl, get);
                        });
                    });
                    return done;
                });

            function nothingToInline() {
                return !shouldProcess(string);
            }
        }
    }

    function newFontFaces() {
        konsole.debug('#newFontFaces');
        return {
            resolveAll: resolveAll,
            impl: {
                readAll: readAll
            }
        };

        function resolveAll() {
            konsole.debug('#newFontFaces #resolveAll');
            return readAll(document)
                .then(function (webFonts) {
                    return Promise.all(
                        webFonts.map(function (webFont) {
                            return webFont.resolve();
                        })
                    );
                })
                .then(function (cssStrings) {
                    return cssStrings.join('\n');
                });
        }

        function readAll() {
            konsole.debug('#newFontFaces #readAll');
            return Promise.resolve(util.asArray(document.styleSheets))
                .then(getCssRules)
                .then(selectWebFontRules)
                .then(function (rules) {
                    return rules.map(newWebFont);
                });

            function selectWebFontRules(cssRules) {
                konsole.debug('#newFontFaces #readAll #selectWebFontRules');
                return cssRules
                    .filter(function (rule) {
                        return rule.type === CSSRule.FONT_FACE_RULE;
                    })
                    .filter(function (rule) {
                        return inliner.shouldProcess(rule.style.getPropertyValue('src'));
                    });
            }

            function getCssRules(styleSheets) {
                konsole.debug('#newFontFaces #readAll #getCssRules');
                var cssRules = [];
                styleSheets.forEach(function (sheet) {
                    try {
                        util.asArray(sheet.cssRules || []).forEach(cssRules.push.bind(cssRules));
                    } catch (e) {
                        konsole.debug('Error while reading CSS rules from ' + sheet.href, e.toString());
                    }
                });
                return cssRules;
            }

            function newWebFont(webFontRule) {
                konsole.debug('#newFontFaces #readAll #newWebFont');
                return {
                    resolve: function resolve() {
                        var baseUrl = (webFontRule.parentStyleSheet || {}).href;
                        return inliner.inlineAll(webFontRule.cssText, baseUrl);
                    },
                    src: function () {
                        return webFontRule.style.getPropertyValue('src');
                    }
                };
            }
        }
    }

    function newImages() {
        konsole.debug('#newImages');
        return {
            inlineAll: inlineAll,
            impl: {
                newImage: newImage
            }
        };

        function newImage(element) {
            konsole.debug('#newImages #newImage');
            return {
                inline: inline
            };

            function inline(get) {
                konsole.debug('#newImages #newImage #inline', 'get', get);

                if (util.isDataUrl(element.src)) return Promise.resolve();

                return Promise.resolve(element.src)
                    .then(get || util.getAndEncode)
                    .then(function (data) {
                        konsole.debug('#newImages #newImage #inline', 'data', data);
                        return util.dataAsUrl(data, util.mimeType(element.src));
                    })
                    .then(function (dataUrl) {
                        konsole.debug('#newImages #newImage #inline', 'dataUrl', dataUrl);
                        return new Promise(function (resolve, reject) {
                            element.onload = resolve;
                            element.onerror = reject;
                            element.src = dataUrl;
                        });
                    });
            }
        }

        function inlineAll(node) {
            konsole.debug('#newImages #inlineAll');
            
            if (!(node instanceof Element)) {
              return Promise.resolve(node);
            }

            return inlineBackground(node)
                .then(function () {
                    if (node instanceof HTMLImageElement)
                        return newImage(node).inline();
                    else
                        return Promise.all(
                            util.asArray(node.childNodes).map(function (child) {
                                return inlineAll(child);
                            })
                        );
                });

            function inlineBackground(node) {
                konsole.debug('#newImages #inlineAll #inlineBackground');

                var background = node.style.getPropertyValue('background');

                if (!background) return Promise.resolve(node);

                return inliner.inlineAll(background)
                    .then(function (inlined) {
                        node.style.setProperty(
                            'background',
                            inlined,
                            node.style.getPropertyPriority('background')
                        );
                    })
                    .then(function () {
                        return node;
                    });
            }
        }
    }
})(this);