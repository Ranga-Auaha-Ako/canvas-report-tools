// ==UserScript==
// @name         Canvas Quiz to excel
// @namespace    https://github.com/sukotsuchido/CanvasUserScripts
// @version      0.1
// @description  Allows the user to print quizzes from the preview page.
// @author       Wen Hol customized to allow for quizbanks
// @include      https://*/courses/*/question_banks/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js


// ==/UserScript==
(function() {
    $(document).ready ( function(){
        var parent = document.querySelector('#right-side');
        el = document.createElement('button');
        el.classList.add('Button','element_toggler','button-sidebar-wide');
        el.type = 'button';
        el.id = 'printQuizButton';
        var icon = document.createElement('i');
        icon.classList.add('icon-document');
        el.appendChild(icon);
        var txt = document.createTextNode(' Download to excel');
        el.appendChild(txt);
        el.addEventListener('click', allMatchQuestions);
        parent.appendChild(el);
    });
    var $tmpTable= $('<table id="tmpTable" />');
    var CRLF = '<br> \r\n';

    var quizTitle = jQuery('.quiz-header').find('.displaying').text();
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();
    var debug = 0;
    if (dd < 10) {
        dd = '0' + dd;
    }
    if (mm < 10) {
        mm = '0' + mm;
    }
  //courseId = getCourseId();
 // quizId = getQuizId();

    today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
    function allMatchQuestions(){
        jQuery("#questions").removeClass("brief");
        jQuery( '.quiz-header p' ).hide();
        var allMatchQuestions = document.querySelectorAll("div.matching_question");
        for (var z = 0; z < allMatchQuestions.length; z++) {
            var options = allMatchQuestions[z].querySelector("select").options;
            var list = document.createElement('div');
            var matchText = document.createElement('div');
            matchText.style.verticalAign = 'middle';
            matchText.innerHTML ='<strong>Match Choices:</strong>';
            for (var t = 0; t < options.length; t++) {
                if(options[t].textContent !=="[ Choose ]"){
                    temp = document.createElement('div');
                    temp.innerHTML = options[t].text;
                    temp.style.display = 'inline-block';
                    temp.style.padding ='20px';
                    temp.style.maxWidth = '25%';
                    temp.style.verticalAlign = 'Top';
                    list.appendChild(temp);
                }
                list.style.width = 'inherit';
                list.style.border = "thin dotted black";
                list.style.padding = "0px 0px 0px 10px";
                var optionsList = allMatchQuestions[z].querySelector(".answers");
                optionsList.appendChild(matchText);
                matchText.appendChild(list);
                var hideOptions = allMatchQuestions[z].querySelectorAll("select");
                console.log(hideOptions);
                for (var q = 0; q < hideOptions.length; q++) {
                    var hideChoice = hideOptions[q].querySelector("select");
                    hideOptions[q].style.visibility="hidden";
                }
            }
        }
        multiSelectQuestions();
        printQuizStyle();
    }
    function multiSelectQuestions(){
        var allMultiSelectQuestions = document.querySelectorAll("div.multiple_dropdowns_question select");
        for (var q = 0; q < allMultiSelectQuestions.length; q++) {
            var len = allMultiSelectQuestions[q].options.length;
            allMultiSelectQuestions[q].setAttribute('size', len);
            allMultiSelectQuestions[q].style.width = 'fit-content';
            allMultiSelectQuestions[q].style.maxWidth ='';
        }
    }
    function printQuizStyle(){
        var scale = document.querySelector("div.ic-Layout-contentMain");
        scale.style.zoom = "74%";
        var questionBlocks = document.querySelectorAll("div.question_holder");
        for (var i = 0; i < questionBlocks.length; i++) {
            questionBlocks[i].style.pageBreakInside = "avoid";
        }
        var answerChoices = document.querySelectorAll("div.answer");
        for (var j = 0; j < answerChoices.length; j++) {
            //answerChoices[j].style.display = "inline-block";
            //answerChoices[j].style.width = "22%";
            answerChoices[j].style.verticalAlign = "Top";
            answerChoices[j].style.borderTop = "none";
        }

        //This hides the Submit Quiz footer - delete the /* */ comment tags to hide the footer.
        var formActions = document.querySelectorAll("div.alert,div.ic-RichContentEditor,div.rce_links");
        for (var h = 0; h < formActions.length; h++) {
            formActions[h].style.visibility = "hidden";
        }
        var essayShrink = document.querySelectorAll("div.mce-tinymce");
        for (var m = 0; m < essayShrink.length; m++) {
            essayShrink[m].style.height = "200px";
        }
        var bottomLinks = document.querySelectorAll(".bottom_links");
        for (var k = 0; k < bottomLinks.length; k++) {
            bottomLinks[k].style.visibility = "hidden";
        }
        var arrowInfo = document.querySelectorAll(".answer_arrow");
        for (var l = 0; l < arrowInfo.length; l++) {
            arrowInfo[l].style.visibility = "hidden";
        }
        var labelDetails = document.querySelectorAll( "label[for='show_question_details']" );
        for (var l = 0; l < labelDetails.length; l++) {
            labelDetails[l].style.visibility = "hidden";
        }
        jQuery( '#show_question_details' ).hide();
        //get all questions to table

        jQuery('.question').each( function(){
           if ( jQuery(this).find('.question_text').text().trim() !=""){

                jQuery(this).find('.header').each( function(){
                    $tmpTable.append( "<tr><td>" + jQuery(this).text() + "</td></tr>" );
                });
                let tmpQtext = jQuery(this).find('.question_text').html();
                let tmpOptions = '';
                jQuery(this).find('.answer_text').each( function(){
                    tmpOptions += '&nbsp;&nbsp;&nbsp;&nbsp;' + jQuery(this).text() +  CRLF;
                })
                $tmpTable.append( "<tr><td>" + tmpQtext +   CRLF + tmpOptions + "</td></tr>" );
                if (debug) console.log( tmpQtext, tmpOptions );
           }
          })
        //table to spreadsheet
        ExportToExcel();
        //window.print();
    }

    function ExportToExcel() {
        jQuery('body').append( $tmpTable );
        var elt = document.getElementById('tmpTable');
        var wb = XLSX.utils.table_to_book(elt, { sheet: "sheet1" });

        wb.Props = {
            Title: quizTitle,
            Subject:"",
            Author: "",
            CreatedDate: new Date()
         };
        let wbout = XLSX.write(wb, {bookType:'xlsx',  type: 'binary'});
        let blob = new Blob([ s2ab(wbout) ], {
            'type': 'application/octet-stream'
        });

      let savename = 'quizbank' + quizTitle + '-' + today + '.xlsx';
      saveAs(blob, savename);
     }

     function s2ab(s) {
        var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
        var view = new Uint8Array(buf);  //create uint8array as viewer
        for (var i=0; i<s.length; i++) {
          view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
        }
        return buf;
      }
})();
