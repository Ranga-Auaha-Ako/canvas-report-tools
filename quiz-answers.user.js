// ==UserScript==
// @name        Canvas quiz essay answer submission download for quantext analysis ( quantext.co.nz )
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a .CSV download of the quiz submissions information
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/quiz-answers.user.js
// @include     https://*/courses/*/quizzes/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @version     0.1
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  // questionsArray to store questions
  var questionsArray = [];
  // answersArray to store answers of each questions 
  var answersArray = []; 

  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var reporttype;
  var ajaxPool;
  var courseId;
  var quizId;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var debug = 0;
  var resultUrlArray = [];
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  addQuizAnswersButton();

  function addQuizAnswersButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {

        if ($('#quiz-answers-report').length === 0) {
          $('.page-action-list').append('<li><a href="javascript:void(0)" id="quiz-answers-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Quiz Answers Download</a></li>');
          $('#quiz-answers-report').one('click', {
            type: 2
          }, quizAnswersReport);
        }
      //} catch(e){}


    return;
  }

  function abortAll() {
    for (var i = 0; i < ajaxPool.length; i++) {
      ajaxPool[i].abort();
    }
    ajaxPool = [
    ];
  }
  function setupPool() {
    try {
      ajaxPool = [
      ];
      $.ajaxSetup({
        'beforeSend': function (jqXHR) {
          ajaxPool.push(jqXHR);
        },
        'complete': function (jqXHR) {
          var i = ajaxPool.indexOf(jqXHR);
          if (i > - 1) {
            ajaxPool.splice(i, 1);
          }
        }
      });
    } catch (e) {
      throw new Exception('Error configuring AJAX pool');
    }
  }

  function quizAnswersReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    courseId = getCourseId();
    quizId = getQuizId();
    if (debug) console.log( courseId, quizId );
    var url = '/api/v1/courses/' + courseId + '/quizzes/'+ quizId + '/submissions?include[]=submission&per_page=50';
    //https://auckland.test.instructure.com:443/api/v1/courses/41929/quizzes/37835/submissions?include[]=submission
    progressbar();
    pending = 0;
    getAnswers( url, courseId, quizId );

  }

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
  }

  function getAnswers( url, courseId, quizId ) { //cycles through the student list
    var quiz_submissions = [];
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( "getting answers:", url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        quiz_submissions = udata.quiz_submissions;
        if (debug) console.log( "quiz_submissions:", quiz_submissions );

        for (var i = 0; i < quiz_submissions.length; i++) {
          var submission = quiz_submissions[i];
          if (debug) console.log( "submission:", submission );

          try {
              if ( "result_url" in submission && submission.result_url!="" ) {
                resultUrlArray.push( submission.result_url );
              } else if ( "html_url" in submission && submission.html_url!="" ) {
                resultUrlArray.push( submission.html_url );
              }
          } catch(e){ continue; }
        }
        if (url) {
          getAnswers( url, courseId, quizId );
        }
        pending--;
        if (pending <= 0) {
            if (debug) console.log( "resultUrlArray", resultUrlArray );
            getQuizAnswerReport( courseId, quizId );

        }
      }).fail(function () {
        pending--;
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getQuizAnswerReport( courseId, quizId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    var url = "";
    for (var i=0; i<resultUrlArray.length;i++) {
      pending++;
      url = resultUrlArray[i];
      if (debug) console.log( "in getQuizAnswerReport", url );
      getQuizAnswers( url, courseId, quizId );

    }
  
    //makeReport( courseId, quizId );

  }


  function getQuizAnswers( url, courseId, quizId ) { //get answer data
    var tmpQuizSubmissions;
    var tmpItem;
    var tmpUrl;
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      //pending++;
      progressbar(fetched, needsFetched);
      $.get(url, function (adata, status, jqXHR) {
        jQuery(adata).find('.quiz_response_text').each(
          function(){
            var tmpAns = jQuery( this ).text().trim();
            if (debug) console.log( "answer:", tmpAns);
            if ( tmpAns == "" ){
              //pending--;
              return; 
            }
            var tmpQuestionObj = jQuery( this ).closest('.question').find('.question_text')[0];
            var tmpQuestion = jQuery(tmpQuestionObj).text().trim();
            if (debug) console.log( "question:", tmpQuestion );
            if (tmpQuestion=="") {
              //pending--;
              return;
            }
            //save the answer  into attemptAr
            if ( tmpQuestion!="" && ( questionsArray.indexOf( tmpQuestion ) < 0 ) ) {
              questionsArray.push( tmpQuestion );
            }
            var tmpQuizId = questionsArray.indexOf( tmpQuestion );
            if( typeof answersArray[ tmpQuizId ] === 'undefined') {
              answersArray[ tmpQuizId ] = [];
            }
            answersArray[ tmpQuizId ].push( tmpAns );
            //pending--;
          }
        );
        pending--;
        if (debug) console.log( "get quizAnswers pending:", pending );
        if (pending <= 0 && !aborted) {
          makeReport( courseId, quizId );
        }
      }).fail(function () {
        pending--;
        fetched+=50;
        progressbar(fetched, needsFetched);
        if (!aborted) {
          console.log('Some report data failed to load');
        }
      });
    } catch (e) {
      errorHandler(e);
    }
  }

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

  function getQuizId() { //identifies quiz ID from URL
    var quizId = null;
    if (debug) console.log( "in getQuizId: window.location", window.location.href );

    try {
      var quizRegex = new RegExp('/quizzes/([0-9]+)');
      var matches = quizRegex.exec(window.location.href);
      if (matches) {
        quizId = matches[1];
      } else {
        throw new Error('Unable to detect quiz ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return quizId;
  }

  
  function makeReport( courseId, quizId ) { //generates CSV of data
    var csv;
    var quizTitle="";
    var courseTitle="";
    var tmpArr = [];
    try {
        courseTitle=document.title.split( ":" ).slice(-1)[0].replace(/[^\w]/g, "");
        quizTitle=document.title.split( ":" )[0].replace(/[^\w]/g, "");
    } catch(e){}
    if (debug){
      console.log( "in make Report questionsArray:", questionsArray  );
      console.log( "in make Report answersArray:", answersArray  );
    }

    //try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();
      var wb = XLSX.utils.book_new();
      wb.Props = {
        Title: quizTitle,
        Subject:courseTitle,
        Author: "",
        CreatedDate: new Date()
      };
      //Quantext fisrt worksheet name 'qIndex'
      wb.SheetNames.push("qIndex");
      /*
      for (var i=0;i< questionsArray.length;i++ ){
        tmpArr[i]=[];
        //tmpArr.push( [ "Q"+i, questionsArray[i] ] );
        tmpArr[i] = [ "Q"+i, questionsArray[i] ] ;
        console.log( "tmpArr[i] is array:", Array.isArray(tmpArr[i])  );
      }*/
      /* assuming data is an array of typed arrays */
      var aoa = [];
      for(var i = 0; i < questionsArray.length; ++i) {
          aoa[i] = [];
          aoa[i][0] = "Q"+i;
          aoa[i][1] = questionsArray[i];
      }
      //console.log( "tmpArr:",  tmpArr );

      var ws = XLSX.utils.aoa_to_sheet( aoa );
      wb.Sheets["qIndex"] = ws;
      if (debug) console.log( "passed qIndex" );
      // end for first worksheet qIndex

      // add each answers worksheet 
      for ( var i=0; i<answersArray.length;i++){
        wb.SheetNames.push( "Q" + i );
        //reset and assign answer array to  tmpArr
        var tmpArr = [];
        for(var j = 0; j < answersArray[i].length; ++j) {
          tmpArr[j] = [];
          tmpArr[j][0] = answersArray[i][j];
          tmpArr[j][1] = j;
        }
        
        ws = XLSX.utils.aoa_to_sheet( tmpArr );
        wb.Sheets[ "Q"+ i ] = ws;
      }
      //csv = createQuizAnswersXLS();
      var wbout = XLSX.write(wb, {bookType:'xlsx',  type: 'binary'});

     
        var blob = new Blob([ s2ab(wbout) ], {
          'type': 'application/octet-stream'
        });
        
        var savename = 'course-' + courseTitle + '-quizAnswers-' + quizTitle + '-' + today + '.xlsx';
        saveAs(blob, savename);
        $('#quiz-answers-report').one('click', {
            type: 2
        }, quizAnswersReport);
        resetData();

      
    //} catch (e) {
    //  errorHandler(e);
    //}
  }
  //convert the binary data into octet
  function s2ab(s) {
    var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
    var view = new Uint8Array(buf);  //create uint8array as viewer
    for (var i=0; i<s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
    }
    return buf;
  }
//////////////////////////

    ////////////////////////
  function excelDate(timestamp) {
    var d;
    try {
      if (!timestamp) {
        return '';
      }
      timestamp = timestamp.replace('Z', '.000Z');
      var dt = new Date(timestamp);
      if (typeof dt !== 'object') {
        return '';
      }
      d = dt.getFullYear() + '-' + pad(1 + dt.getMonth()) + '-' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
      //d = ""+ pad(dt.getFullYear()-2000) +  pad(1 + dt.getMonth()) +  pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    } catch (e) {
      errorHandler(e);
    }
    return d;
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
  }

  function progressbar(x, n) {
    try {
      if (typeof x === 'undefined' || typeof n == 'undefined') {
        if ($('#jj_progress_dialog').length === 0) {
          $('body').append('<div id="jj_progress_dialog"></div>');
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins for large courses</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Report',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, quizSubmissionReport);
                  if (debug) console.log( "done set submission report link" );
                  $(this).dialog('close');
                  aborted = true;
                  abortAll();
                  resetData();

                }
              }
            ]
          });
        }
        if ($('#jj_progress_dialog').dialog('isOpen')) {
          $('#jj_progress_dialog').dialog('close');
        } else {
          $('#jj_progressbar').progressbar({
            //'value': false
            'value': 0
          });
          $('#jj_progress_dialog').dialog('open');
          
        }
      } else {
        if (!aborted) {
          var val = n > 0 ? Math.round(100 * x / n)  : false;
          $('#jj_progressbar').progressbar('option', 'value', val);
        }
      }
    } catch (e) {
      errorHandler(e);
    }
    
  }
  function resetData(){
    questionsArray = [];
    // answersArray to store answers of each questions 
    answersArray = []; 
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

