// ==UserScript==
// @name        Canvas global glossary
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas page, glossary tooltip replace
// @include     https://*/courses/*/pages/*
// @exclude     https://*/courses/*/pages/*/edit
// @exclude     https://*/courses/*/pages/*/globay-glossary
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @grant          GM_addStyle
// @version     0.4
// ==/UserScript==
GM_addStyle(`
abbr {
	font-style: italic;
	position: relative
  }

  abbr:hover::after {
	background: #add8e6;
	border-radius: 4px;
	bottom: 100%;
	content: attr(title);
	display: block;
	left: 100%;
	padding: 1em;
	position: absolute;
	width: 280px;
	z-index: 1;
  }
`
);
(function () {
  'use strict';
  //globalGlossary to store glossries in json format
  var globalGlossary = {};
  // what tag names to search and replace terms
  var lookupTagName = 'p, div, span';
  // class of what already replaced terms not to be replaced again
  var replaceClass = 'glossary'	;
  var courseId;
  var replaceOnce = 0;
  var regexOption = replaceOnce? 'i': 'ig';
  // exclude array for classes or id etc, content not to be replaced
  var excludes = [];
  var glossaryReplaced = {};
  var debug = 0;
  var exprStr = ''; // this to store regular expression matching pattern
  glossaryReplace();


  function getCourseId() { //identifies course ID from URL
    var courseId = null;
    if (debug) console.log( "in getCourseId: window.location", window.location.href );
    try {
      var courseRegex = new RegExp('/courses/([0-9]+)');
      var matches = courseRegex.exec(window.location.href);
      if (matches) {
        courseId = matches[1];
      } else {
        throw new Error('Unable to detect Course ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return courseId;
  }

  function glossaryReplace(e) { //gets the glossary list

    courseId = getCourseId();

    if (debug) console.log( courseId );

    let url = '/api/v1/courses/'+ courseId + '/pages/global-glossary';
    getGlossaries( url );

  }




  function getGlossaries ( url ) {
    let glossaryHtml = ''
    $.getJSON(url, function (adata, status, jqXHR) {

        if ( 'body' in adata ){
            glossaryHtml = adata.body;
            if (debug) console.log({glossaryHtml});
            parseGlossary( glossaryHtml );
        }
    } );
  }

  function parseGlossary( glossaryHtml ){
    let tmpTerm, tmpDefinition;
    let tmpTermId;
    let tmpDefId;
    if ( typeof glossaryHtml === undefined ){
        return;
    }
    //
    let tmpDom = jQuery.parseHTML( glossaryHtml );
    if (debug) console.log({tmpDom});
    $.each( tmpDom, function( i, el ) {
        if ( el.nodeName=="H3" ){
            tmpTerm = el.innerHTML.trim();
            if (debug) console.log( {tmpTerm}, i);
            tmpTermId = i;
        } else if ( el.nodeName=='P' ){
            tmpDefinition = el.innerHTML;
            if (debug) console.log( {tmpDefinition}, i );
            tmpDefId = i;
        }
        if ( ( tmpDefId < (tmpTermId +3) ) && ( tmpDefId > tmpTermId ) ){
            if ( (tmpTerm !='') && (tmpDefinition!='') ){
                globalGlossary[tmpTerm] = tmpDefinition.replace( /'/g, '&lsquo;' ).replace( /&#39;/g, '&lsquo;' );
            }

        }
    });

    if (debug) console.log( {globalGlossary} );
	if ( Object.keys(globalGlossary ).length>0 ){
        //document.addEventListener('DOMContentLoaded', wrapTerms, false);
        let tmpKeyAr = Object.keys(globalGlossary); 
        if (debug) console.log( tmpKeyAr );
        for ( let tmpKey of tmpKeyAr ){
            if ( exprStr!='' ){
                exprStr += "|";
            }
            if ( /\s/.test(tmpKey) ){ // if term contains space, ie not a single word
                exprStr += tmpKey;
            } else {
                exprStr += '\\b'+ tmpKey + '\\b';
            }
        }

        //exprStr = '('+Object.keys(globalGlossary).join('|')+ ')';
        exprStr = '('+ exprStr + ')';
        if (debug) console.log( "matching expr:", exprStr );
        $( '.user_content' ).ready(function() {
            setTimeout(function(){
                wrapTerms();
            }, 1000);

        } );

	}
  }

  //wrapTerms to replace term with tooltip
  function wrapTerms(){
    if (debug) console.log( 'in wrapTerms' );
    let el = document.querySelector('.user_content');
      
    let nodes = el.querySelectorAll(lookupTagName)

    for(var i =0; i < nodes.length; i++){
        if ( debug ) {
            console.log( "traverser:", nodes[i] );
        }
        traverser(nodes[i]);

    }
  }


  function traverser(node){
	// provide the style in uoa css or customise whatever suit
	// abbr {
	// 	font-style: italic;
	// 	position: relative
	//   }

	//   abbr:hover::after {
	// 	background: #add8e6;
	// 	border-radius: 4px;
	// 	bottom: 100%;
	// 	content: attr(title);
	// 	display: block;
	// 	left: 100%;
	// 	padding: 1em;
	// 	position: absolute;
	// 	width: 280px;
	// 	z-index: 1;
	//   }

    let next;
    //let arrayKeys = Object.keys(globalGlossary);
    //let exprStr = '';
	//let re = new RegExp('\\b('+Object.keys(globalGlossary).join('|')+ ')\\b', regexOption);
    //exprStr = '('+Object.keys(globalGlossary).join('|')+ ')';
    let re = new RegExp(exprStr, regexOption);
    if (debug) console.log( "regex string:", exprStr );
    // this one to check if is within excluded string list
    
    let reEx = new RegExp('\\b('+excludes.join('|')+ ')\\b', regexOption);
    
	    
	let tmpDefinition = '';
    if (debug) console.log( "traverser:", node );
    if (node.nodeType === 1) {

        /*
         Element Node
         */

        //console.log(node.nodeName)
        if (node = node.firstChild) {
                do {
                    // Recursively call traverseChildNodes
                    // on each child node
                    next = node.nextSibling;

                    /**
                     * Check if the node is not glossarized
                     */
                    if(	node.nodeName != 'a' &&
                        node.className != replaceClass) {

                        traverser(node)

                    }

                } while(node = next)
        }

    } else if (node.nodeType === 3) {

        /*
         Text Node
         */

        let temp = document.createElement('div'),
            data = node.data;


        if(re.test(data)){
            if (debug){
                console.log({data});
            }


            data = data.replace(re,function(match, item , offset, string){

                //var ir = new RegExp('\\b'+match+'\\b');
                match = match.trim();
                let ir = new RegExp(match);
                let excl='';
                if ( excludes.length >0 ) {
                    excl = reEx.exec(data);
                }
    
    
                let result = ir.exec(data);

                // if contain excluded text
                if (result){
                    if (debug) console.log( 'contains' );
					tmpDefinition = getDescription( match );
                    //if contain excluded terms etc
                    if (excl){
                        if (debug) console.log( 'contain exclude:', excl );
                        var id = offset,
                            exid = excl.index,
                            exl = excl.index + excl[0].length;

                        if (exid <= id && id <= exl){

                            return match;

                        }else{
                            if ( !( match in glossaryReplaced ) ) {
                                glossaryReplaced[ match ]=1;

								return `<abbr
                                    class="glossary"
                                    title="${tmpDefinition}"
                                     >${match} </abbr>`;

                            } else {
                                return match;
                            }

                        }
                    } else {
                        if ( replaceOnce ) { // if only allow replace once
                            if ( match in glossaryReplaced ) {
                                //already replaced
                                return match;
                            } else {
                                glossaryReplaced[ match ]=1;
                                return `<abbr
                                    class="glossary"
                                    title="${tmpDefinition}"
                                     >${match} </abbr>`;
                            }

                            
							
							// return `<span
                            //         class="glossary"
                            //         data-text="${tmpDefinition}"
                            //          >${match} </span>`;
            //                 return `<a href="javascript:void(0);" class="glossary"
            // onmouseover="showPopUpDiv( event, { width:300, hint:'${tmpDefinition}', lower:0,left:0 } );"
            // onfocus="showPopUpDiv( event, { width:300, hint:'${tmpDefinition}', lower:0,left:0 } );"
            //  onmouseout="hidePopUpDiv()" onmouseout="hidePopUpDiv()">${match} </a>`;
                        } else {
                            return `<abbr
                                    class="glossary"
                                    title="${tmpDefinition}"
                                     >${match} </abbr>`;
                        }

                    }
                }


            });

        }


        temp.innerHTML = data;


        while (temp.firstChild) {
            node.parentNode.insertBefore(temp.firstChild, node)
        }

        node.parentNode.removeChild(node)

    }

}
  //get the description of a matched term
  function getDescription(term){
	// not use term in object, as there might be upper/lower cases
    let regex = new RegExp('(^\s*|[^\!])'+term+'\\s*|\\,$', 'i');

	let glossaryKeys = Object.keys( globalGlossary );
    for(var i =0; i< glossaryKeys.length; i++){

        if ( glossaryKeys[i].match(regex) ){
            return globalGlossary[ glossaryKeys[i] ].replace( /'/g, '&lsquo;' ).replace( /&#39;/g, '&lsquo;' );
        }
    }

  }


  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

