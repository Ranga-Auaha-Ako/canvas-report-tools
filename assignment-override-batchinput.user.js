// ==UserScript==
// @name        Assist Assignment/Quiz Override Student Names Batch Input
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Assist Assignment/Quiz Override Student Names Batch Input
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-override-batchinput.user.js
// @include     https://*/courses/*/quizzes/*/edit
// @include     https://*/courses/*/assignments/*/edit
// @include     https://*/courses/*/quizzes/new
// @include     https://*/courses/*/assignments/new
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @version     0.6
// @grant       none
// ==/UserScript==
(function() {
    'use strict';
    var courseId = getCourseId();
    var loginIdAr = {};
    var loginAr = {};
    var uoaIdAr = {};
    var nameAr = [];
    var repeatedNameAr = [];
    var studentsLoaded = 0;
    var nameChecked = 0;
    var debug = 0;
    var debugName = 1;
    var pending = - 1;
    const timer = ms => new Promise(res => setTimeout(res, ms));

    //quizId = getQuizId();
    if (debug) console.log( courseId );
    var studentsUrl = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=50';

    /* jQuery('#overrides-wrapper').ready(
        function(){
            //if (jQuery('#overrides-wrapper').length) {
            //    jQuery('#overrides-wrapper').prepend( `<a id="inputAssistance" class="inputAssistance" style="float:right;" href="javascript:void(0)">toggle input assistance</a>` );
            //}
            if (jQuery('.ContainerDueDate').length) {
                jQuery('.ContainerDueDate').append( `<p><button class="inputAssistance Button Button--add-row" type="button">toggle input assistance</button></p>` );
            }
            jQuery('.inputAssistance').on('click', toggleInput );

        }
    ) */
    jQuery('#overrides-wrapper').ready(
        function(){
            jQuery('#content').append( `<div id="inputAssistDiv"><span class="inputAssistance Button Button--add-row" type="button"><img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/> Fetching student informaiton for input assistance</span></div>` );
            //jQuery('.inputAssistance').on('click', toggleInput );
        }
    ) ;
    getStudents( studentsUrl, courseId );


    function toggleInput(){
        let targetI = 0;
        if ( jQuery('.importWrapper').length>0 ){
            jQuery('.importWrapper').remove();
        } else {
            let inputAll = document.querySelectorAll('input.ic-tokeninput-input');
            inputAll.forEach(function( tmpInput, index ){
                targetI=index;
                let a= jQuery(tmpInput);
                let parent = a.parents( '.Container__DueDateRow-item');
                let theLabel = parent.find('#assign-to-label');
                let insertTextbox= `<textarea id='myImport${index}' rows='8' style="border:1px solid red;width:10rem;" />`;

                let importBtn = `<br><a id="importStudents${index}" style="margin-left:20px;" >import</a><br>`;
                theLabel.append( `<div class='importWrapper' id='importWrapper${index}' style="overflow:auto;margin:10px;margin-right:-30px;float:right;clear:both">`+ importBtn + insertTextbox +  `</div>` );
                //to add onchanage function to textarea//
                jQuery(`#importStudents${index}`).on('click', {index:index}, importStudents );

            });
            jQuery(`#myImport${targetI}`).focus();

        }
        return false;
    }

    async function importStudents( e ){
        let tmpIndex = e.data.index;
        let nameFound = 0;
        //console.log( 'importStudents:', tmpIndex );
        let tmpId = 'myImport'+ tmpIndex;
        let tmpInput = document.querySelectorAll('input.ic-tokeninput-input')[tmpIndex];
        let tokenList = jQuery( jQuery('.ic-tokens')[tmpIndex] );

        let remainedAr = [];
        let doubledAr = [];
        //console.log( tmpInput );
        if (!tmpInput){
            return;
        }
        //get students list
        let tmpStr = jQuery('#'+tmpId).val();
        //console.log( tmpStr );
        if ( tmpStr=='' ){
            return;
        }
        let tmpLines = tmpStr.split('\n');
        //console.log( tmpLines, tmpLines.length );

        let tmpSS ='';
        let tmpName = '';
        if ( tmpLines.length == 0 ){
            return;
        }
        for ( let i=0; i<tmpLines.length; i++ ){
            //then
            nameFound = 0;
            tmpSS = '';
            tmpName = tmpLines[i].trim();
            if (debugName) console.log( 'tmpName:', tmpName )

            if ( tmpName=='' ){
                continue;
            }

            if ( studentsLoaded ){
                //if studentsLoaded, check if double name exist
                if (debug) console.log( 'add with names loaded' );
                // if there are multiple students of the same name tmpName
                if ( repeatedNameAr.length>0 && (repeatedNameAr.indexOf(tmpName) >-1) ){
                    doubledAr.push( tmpName );
                    continue;
                }
                //if the line is not name,
                if  ( nameAr.indexOf( tmpName )<0  ){
                    //find name with upi
                    if ( tmpName in loginAr ){
                        tmpSS = loginAr[ tmpName ];
                    } else if ( tmpName in uoaIdAr ){
                        tmpSS = uoaIdAr[ tmpName ];
                    }
                } else{
                    tmpSS = tmpName;
                }
            } else{
                tmpSS = tmpName;
            }

            if (debugName) console.log( 'tmpSS:', tmpSS )

            if ( tmpSS=='' ){
                continue;
            }
            let eventChange = new Event('change', { bubbles: true });
            eventChange.simulated = true;
            let eventClick = new Event('click', { bubbles: true });
            eventClick.simulated = true;
            let eventKeyUp = new Event('keyup', { bubbles: true });
            eventKeyUp.simulated = true;
            let eventBlur = new Event('blur', { bubbles: true });
            eventBlur.simulated = true;
            let eventKeyDown = new KeyboardEvent("keydown", {
                bubbles: true, cancelable: true, keyCode: 13
            });
            eventKeyDown.simulated = true;
            tmpInput.value=tmpSS;
            let tracker = tmpInput._valueTracker;
            if (tracker) {
                tracker.setValue(tmpSS);
            }
            tmpInput.dispatchEvent(eventChange);
            tmpInput.dispatchEvent(eventClick);
            tmpInput.dispatchEvent(eventKeyUp);
            tmpInput.dispatchEvent(eventKeyDown);
            //await timer(500);
            if ( tokenList.html().indexOf( tmpSS ) <0 ) {
                console.log( tmpSS, " not Added" );
                remainedAr.push( tmpSS );
                await timer(2500);
                //tmpInput.dispatchEvent(eventKeyUp);
                //tmpInput.dispatchEvent(eventKeyDown);
                //tmpInput.dispatchEvent(eventBlur);

                
            }
            


        }
        //reset textarea;

        jQuery('#'+tmpId).val(remainedAr.join('\n')+doubledAr.join('\n'));
        if ( remainedAr.length>0 ) {
            let remainedStr = remainedAr.join( ',' );
            //alert( `Some students not added:${remainedStr}.\n Please input manually` ); 
            //import again
            importStudents(e);
        }
        if ( doubledAr.length>0 ) {
            let doubledStr = doubledAr.join(' ');
            let tmpNameUpi = '';
            for ( let i=0; i< doubledAr.length; i++ ) {
                let tmpResult = getKeyByValue( loginIdAr, doubledAr[i] );
                tmpResult.sort();
                for ( let j=0; j< tmpResult.length; j++ ){
                    //display name with upi
                    tmpNameUpi += doubledAr[i] + '(' + tmpResult[j]+ ')\n';
                }
                if (debugStudent) console.log( tmpResult );
            }

            alert( ` students:${doubledStr} with the same name exist, please input manually:\n` + tmpNameUpi );

        }

        return false;
    }// end importStudents

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
    } // end getCourseId

    function nextURL(linkTxt) { //if more than 100 students, gets the URL for the rest of the list
        var url = null;
        if (linkTxt) {
          var links = linkTxt.split(',');
          var nextRegEx = new RegExp('^<(.*)>; rel="next"$');
          for (var i = 0; i < links.length; i++) {
            var matches = nextRegEx.exec(links[i]);
            if (matches) {
              url = matches[1];
            }
          }
        }
        return url;
    } // end get nextURL

    function getStudents( url, courseId ) { //cycles through the student list
        //try {
          if ( studentsLoaded || nameChecked ){
              return;
          }
          //jQuery("#doing").html( "Fetching student informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
          pending++;
          $.getJSON(url, function (udata, status, jqXHR) {
            url = nextURL(jqXHR.getResponseHeader('Link'));
            if (debug) console.log("next url:", url );
            for (var i = 0; i < udata.length; i++) {
              var section = udata[i];
              try {
                  if (section.students.length > 0) {
                      for (var j = 0; j < section.students.length; j++) {
                        // login_id === upi
                        var user = section.students[j];
                        //upiAr
                        loginIdAr[user.id+'-'+user.login_id] = user.short_name;
                        loginAr[user.login_id] = user.short_name;
                        //studentIdAr
                        uoaIdAr[user.sis_user_id]= user.short_name;
                        //register name in nameAr
                        nameAr.push(  user.short_name );


                      } // end for
                  } // end if length>0
              } catch(e){ continue; }
            }
            if (debug) console.log( "next url ?", url );
            //if (debug) console.log( "number ss:", studentIdAr.length );
            if (url) {
              getStudents( url, courseId );
            } else {
                studentsLoaded = 1;
                if  (! nameChecked ){
                    nameChecked = 1;
                    checkDoubleName();
                }
                jQuery('#inputAssistDiv').html( `<button class="inputAssistance Button Button--add-row" type="button">toggle input assistance</button>` );
                jQuery('.inputAssistance').on('click', toggleInput );
                if (debug) console.log( "Students name loaded, repeated names:", repeatedNameAr );
            }
          }).fail(function () {
            pending--;
            throw new Error('Failed to load list of students');
          });
        //} catch (e) {
        //  errorHandler(e);
        //}
    } // end getStudents
    function checkDoubleName(){
        nameChecked = 1;

        const countName = nameAr =>
            nameAr.reduce((a, b) => ({
                ...a,
                [b]: (a[b] || 0) + 1
             }), {});
        let countNameAr = countName( nameAr );
        const duplicates = dict =>
             Object.keys(dict).filter((a) => dict[a] > 2);
        repeatedNameAr = duplicates( countNameAr );
        if (debug){
            console.log( "countNameAr:", countNameAr );
            console.log( "duplicated names:", repeatedNameAr );
        }
    }

    function getKeyByValue(object, value) {
        return Object.keys(object).filter(key => object[key] === value);
    }

    function errorHandler(e) {
        console.log(e.name + ': ' + e.message);
    }
})();
