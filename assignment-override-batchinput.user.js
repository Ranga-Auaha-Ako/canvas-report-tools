// ==UserScript==
// @name        Assist Assignment/Quiz Override Student Names Batch Input
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Assist Assignment/Quiz Override Student Names Batch Input
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-override-batchinput.user.js
// @include     https://*/courses/*/quizzes/*/edit
// @include     https://*/courses/*/assignments/*/edit
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @version     0.1
// @grant       none
// ==/UserScript==
(function() {
    'use strict';
    
    if (jQuery('#overrides-wrapper').length) {
        jQuery('#overrides-wrapper').prepend( `<a id="inputAssistance" style="float:right;" href="javascript:void(0)">toggle input assistance</a>` );
    }
    jQuery('#inputAssistance').on('click', toggleInput );
    function toggleInput(){

        if ( jQuery('.importWrapper').length>0 ){
            jQuery('.importWrapper').remove();
        } else {
            let inputAll = document.querySelectorAll('input.ic-tokeninput-input');
            inputAll.forEach(function( tmpInput, index ){
                let a= jQuery(tmpInput);
                let parent = a.parents( '.Container__DueDateRow-item');
                let theLabel = parent.find('#assign-to-label');
                let insertTextbox= `<textarea id='myImport${index}' style="margin-left:10px;border:1px solid red;width:10rem;" />`;
                
                let importBtn = `<br><a id="importStudents${index}" style="float:right;" >import</a>`;
                theLabel.append( `<div class='importWrapper' id='importWrapper${index}' style="float:right">`+ insertTextbox + importBtn + `</div>` );              
                //to add onchanage function to textarea//
                jQuery(`#importStudents${index}`).one('click', {index:index}, importStudents );
            });
        }
        
    } 
    
    function importStudents( e ){
        let tmpIndex = e.data.index;
        
        //console.log( 'importStudents:', tmpIndex );
        let tmpId = 'myImport'+ tmpIndex;
        let tmpInput = document.querySelectorAll('input.ic-tokeninput-input')[tmpIndex];
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
        if ( tmpLines.length == 0 ){
            return;
        } 
        for ( let i=0; i<tmpLines.length; i++ ){
            //then 
            tmpSS = tmpLines[i].trim();
            //console.log( 'tmpSS:', tmpSS );
            if ( tmpSS=='' ){
                continue;
            }
            let eventChange = new Event('change', { bubbles: true });
            eventChange.simulated = true;
            let eventClick = new Event('click', { bubbles: true });
            eventClick.simulated = true;
            let eventKeyUp = new Event('keyup', { bubbles: true });
            eventKeyUp.simulated = true;
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
        }
        //reset textarea;
        jQuery('#'+tmpId).val('');
        return false;
    }// end importStudents
    
    

})();
