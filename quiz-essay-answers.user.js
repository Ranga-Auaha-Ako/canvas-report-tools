// ==UserScript==
// @name        Canvas quiz essay answer submission download for Turnitin plagiarism check
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description For Canvas users, this tool generates a zip file download of the all quiz essay answers, for Turnitin to check for plagiarism
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/quiz-essay-answers.user.js
// @include     https://*/courses/*/quizzes/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/jszip.min.js
// @version     0.4
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  var userData = {
  };
  // questionsArray to store questions
  //var questionsArray = [];
  // answersArray to store answers of each questions 
  //var answersArray = []; 

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
  var zip = new JSZip();
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
  addQuizEssayAnswersButton();

  function addQuizEssayAnswersButton() {

    

        if ($('#quiz-answers-report').length === 0) {
          $('.page-action-list').append('<li><a href="javascript:void(0)" id="quiz-essay-answers-report" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Quiz Essay Answers Download</a></li>');
          $('#quiz-essay-answers-report').one('click', {
            type: 2
          }, quizEssayAnswersReport);
        }
    


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

  function quizEssayAnswersReport(e) { //gets the student list
    pending = 0;
    fetched = 0;
    reporttype = e.data.type;
    aborted = false;
    setupPool();
    courseId = getCourseId();
    quizId = getQuizId();
    if (debug) console.log( courseId, quizId );
    var url = '/api/v1/courses/' + courseId + '/sections?include[]=students&per_page=50';
    //https://auckland.test.instructure.com:443/api/v1/courses/41929/quizzes/37835/submissions?include[]=submission
    progressbar();
    pending = 0;
    getStudents( url, courseId, quizId );
    //getAnswers( url, courseId, quizId );

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

  function getStudents( url, courseId, quizId ) { //cycles through the student list
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      jQuery("#doing").html( "Fetching student informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
          var section = udata[i];
          //return if no students
          if ( i==0 && section.students===null ){
            
              pending--;
              alert( "No student found" );
              $('#jj_progress_dialog').dialog('close');
              $('#quiz-essay-answers-report').one('click', {
                type: 2
              }, quizEssayAnswersReport);
              resetData();
              throw new Error('Failed to load list of students');
            
          }
          try {
              if (section.students.length > 0) {
                  for (var j = 0; j < section.students.length; j++) {
                      // login_id === upi
                      var user = section.students[j];
                      var splitname = user.sortable_name.split(',');
                      user.firstname = splitname[1].trim();
                      user.surname = splitname[0].trim();
                      userData[user.id] = user;
                  } // end for
              } // end if length>0
              
          } catch(e){ continue; }
        }
        if (url) {
          getStudents( url, courseId, quizId );
        }
        pending--;
        if (pending <= 0) {
            let urlAns = '/api/v1/courses/' + courseId + '/quizzes/'+ quizId + '/submissions?include[]=submission&per_page=50';

            getAnswers( urlAns, courseId, quizId );

        }
      }).fail(function () {
        pending--;
        $('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load list of students');

      });
    } catch (e) {
      errorHandler(e);
      $('#jj_progress_dialog').dialog('close');
    }
  }
  function getAnswers( url, courseId, quizId ) { //cycles through the student list
    let quiz_submissions = [];
    let tmpName = "";
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( "student Data:", userData );
      if (debug) console.log( "getting answers:", url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        quiz_submissions = udata.quiz_submissions;
        if (debug) console.log( "quiz_submissions:", quiz_submissions );

		
		if ( quiz_submissions.length==0 || quiz_submissions===null ){
            
              pending--;
              alert( "No submission found" );
              $('#jj_progress_dialog').dialog('close');
              $('#quiz-essay-answers-report').one('click', {
                type: 2
              }, quizEssayAnswersReport);
              resetData();
              throw new Error('Failed to load list of students');
            
        }
		needsFetched = quiz_submissions.length;
        for (var i = 0; i < quiz_submissions.length; i++) {
          var submission = quiz_submissions[i];
          let studentid =  submission.user_id;
		  progressbar(i, quiz_submissions.length);
          if (debug) console.log( submission, studentid );
          try {
            tmpName = userData[ studentid ].short_name.replace(/ /g, "");
          } catch(e){
            tmpName = "";
            continue;
          }
          if (debug) console.log( "submission:", submission );
          if (debug) console.log( "tmpName:", tmpName );

          try {
              if ( "result_url" in submission && submission.result_url!="" ) {
                resultUrlArray.push( [ submission.result_url, tmpName+"-"+studentid ] );
              } else if ( "html_url" in submission && submission.html_url!="" ) {
                resultUrlArray.push( [submission.html_url, tmpName+"-"+studentid] );
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
        throw new Error('Failed to load student submissions');
      });
    } catch (e) {
      errorHandler(e);
    }
  }

  function getQuizAnswerReport( courseId, quizId ) { //cycles through student list
    pending = 0;
    fetched = 0;
    let url = "";
    let tmpName= '';
    for (var i=0; i<resultUrlArray.length;i++) {
      pending++;
      url = resultUrlArray[i][0];
      tmpName = resultUrlArray[i][1];
      if (debug) console.log( "in getQuizAnswerReport", url );
      getQuizAnswers( url, courseId, quizId, tmpName );

    }
  
    //makeReport( courseId, quizId );

  }


  function getQuizAnswers( url, courseId, quizId, tmpName ) { //get answer data
    var tmpQuizSubmissions;
    var tmpItem;
    var tmpUrl;
    var savename;
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      if (debug) console.log( url );
      jQuery("#doing").html( "Fetching question answers <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      //pending++;
      progressbar(fetched, needsFetched);
      $.get(url, function (adata, status, jqXHR) {
		fetched +=1;
        let totalAns = "";
        jQuery(adata).find('.quiz_response_text').each(
          function(){
            
            var tmpAns = jQuery( this ).text().trim();
            if (debug) console.log( "answer:", tmpAns);
            if ( tmpAns == "" ){
              //pending--;
              return; 
            }
            let tmpQuestionObj = jQuery( this ).closest('.question').find('.question_text')[0];
            let tmpQuestion = jQuery(tmpQuestionObj).text().trim();
            if (debug) console.log( "question:", tmpQuestion );
            if (tmpQuestion=="") {
              //pending--;
              //return;
            }
            //quotation around question to avoid turnitin 
            totalAns += '"Question:' + tmpQuestion + '"\n' + tmpAns + "\n";
	        progressbar(fetched, needsFetched);

          }
        );
        savename = tmpName + '-course-' + courseId + '.txt';
        if (debug) console.log( "savename:", savename ); 
        if (debug) console.log( "totalAns:", totalAns ); 
        zip.file( savename, totalAns ); 
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
   

    //try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();
      zip.generateAsync({type:"blob"})
      .then(function(content) {
      // Force down of the Zip file
        saveAs(content, courseTitle+"-"+ quizTitle+ "-" + today + ".zip");
      } );
      
        $('#quiz-essay-answers-report').one('click', {
            type: 2
        }, quizEssayAnswersReport);
        resetData();

      
    //} catch (e) {
    //  errorHandler(e);
    //}
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
                  }, quizEssayAnswersReport );
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
    //questionsArray = [];
    // answersArray to store answers of each questions 
    //answersArray = []; 
    resultUrlArray = [];
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

