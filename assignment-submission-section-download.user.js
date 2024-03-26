// ==UserScript==
// @name        Canvas assignment submissions download by section
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Canvas assignment submissions download by section
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/assignment-submission-section-download.user.js
// @include     https://*/courses/*/assignments/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/jszip.min.js
// @require     https://stuk.github.io/jszip-utils/dist/jszip-utils.js
// @require     https://smtpjs.com/v3/smtp.js

// @version     0.2
// @grant       none
// ==/UserScript==
// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement
(function() {
  'use strict';
  // Change studentRegex for international support
  var studentRegex = new RegExp('^([0-9]+) student');
  var pending = -1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var courseId;
  var assignmentId;
  var sections = [];
  var sectionsObj = {};
  var debug = 0;
  var aborted = false;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  var sectionIndex = -1;
  var downloadSectionIndex = -1;
  var senderEmail;
  var errMessage = '';
  var fileIndex = -1;
  // if not wanting to download main lecture section, change the skipMainLectureSection to 1, otherwise change to 0
  var skipMainLectureSection = 0;
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
 // quizId = getQuizId(); 

  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  selfCheck();
  addSubmissionSectionDownload();
  
  function selfCheck(){
    let selfCheckUrl = "/api/v1/users/self";

    $.getJSON(selfCheckUrl, async function (udata, status, jqXHR) {

      try {
        senderEmail = udata.email;

      }catch(e){}
        senderEmail = 'w.hol@auckland.ac.nz';
    } );
  }
  function addSubmissionSectionDownload() {

    

    if ($('#assignment-submissionDownload').length === 0) {
        
        $('#sidebar_content').append(
            '<span><a href="javascript:void(0)" id="assignment-submissionDownload" class="ui-corner-all" role="menuitem"><i class="icon-analytics"></i> Download student submissions by section</a></span><div id="sectionsList"></div>'
            );

        $('#assignment-submissionDownload').one('click', {
        type: 2
        }, submissionSectionDownload );
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
      throw new Error('Error configuring AJAX pool');
    }
  }

  function nextURL(linkTxt) {
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

  function submissionSectionDownload(){
    
    courseId = getCourseId();
    assignmentId = getAssignmentId();
    if ( debug ) console.log( { courseId, assignmentId } );
    if ( !courseId || !assignmentId ){
        return;
    }
    getUserSubmissionInfo( courseId );
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

  function getAssignmentId() { //identifies course ID from URL
    var assignmentId = null;
    try {
      var assignmentRegex = new RegExp('/assignments/([0-9]+)');
      var matches = assignmentRegex.exec(window.location.href);
      if (matches) {
        assignmentId = matches[1];
      } else {
        throw new Error('Unable to detect Assignment ID');
      }
    } catch (e) {
      errorHandler(e);
    }
    return assignmentId;
  }

  function getUserSubmissionInfo(courseId) {
    
    if ( debug ) console.log('in getUsers');
    var chunkSize = 100;
    var chunk;
    var url;
    var i = 0;
    //var n = userList.length;
    pending = 0;
    //url = '/api/v1/courses/' + courseId + '/sections?include[]=students&include[]=email&per_page=100';
    url = '/api/v1/courses/' + courseId + '/sections?per_page=100';
    
    getSections( url, courseId );
    
  }

 
  function getSections( url, courseId ) { //cycles through the student list
    try {
      pending++;
      $.getJSON(url, function (udata, status, jqXHR) {
        url = nextURL(jqXHR.getResponseHeader('Link'));
        for (var i = 0; i < udata.length; i++) {
            let section = udata[i];
            section.files = [];
            sections.push( section );
            sectionsObj[ section.id ] = section;
        }
        if (debug) console.log( "next url ?", url );
        //if (debug) console.log( "number ss:", studentIdAr.length );
        if (url) {
          getSections( url, courseId );
        }
        pending--;
        if (debug) console.log( "pending:", pending );

        if (pending <= 0) {
            console.log( 'done get sections', sections );
            showSectionList();
            //getStudentSubmissionInfo( );

        } else{}
      }).fail(function () {
        pending--;
        //$('#jj_progress_dialog').dialog('close');
        throw new Error('Failed to load list of students');
      });
    } catch (e) {
      pending--;
      //$('#jj_progress_dialog').dialog('close');
      throw new Error('Failed to load list of students');
      
    }
  }
  
  function showSectionList(){
    let selectionHtml = `<br>Please choose your section(s) to download<br>`;
    let sectionName='';
    let sectionId = '';
    for ( let i=0; i<sections.length; i++ ){
      sectionName = sections[i].name;
      sectionId = sections[i].id;
      selectionHtml += `<label><input type="checkbox" name='chooseSections' value='${sectionId}' /> ${sectionName}</label><br>`;
    }
    selectionHtml +='<button id="downloadBySection" >Download</button>';
    jQuery("#sectionsList").html( selectionHtml );
    $('#downloadBySection').one('click', getSectionsChosen );
  }

  function getSectionsChosen(){
    pending = 0;
    fetched = 0;
    aborted = false;
    
    let chosenSections=[];
    $.each($("input[name='chooseSections']:checked"), function(){
      chosenSections.push( sectionsObj[$(this).val()] );
    });
    if ( chosenSections.length >0 ){
      sections = chosenSections;
      console.log( sections );
      setupPool();
      
      progressbar();
      pending = 0;
      jQuery("#sectionsList").html('');
      getStudentSubmissionInfo( );
    } else {
      alert( 'Please choose some section(s) to download' );
    }
    
    
  }

  function getStudentSubmissionInfo( ){
    // get from each sections
    sectionIndex +=1;
    needsFetched = sections.length;
    progressbar( (sectionIndex+1), needsFetched );
    console.log( 'get section submissions:', sections[sectionIndex] );
    if ( sectionIndex < sections.length ){
        let sectionId = sections[sectionIndex].id;
        //sections/264944/assignments/316865/submissions?include[]=user
        let url = `/api/v1/sections/${sectionId}/assignments/${assignmentId}/submissions?include[]=user&per_page=50`;
        if (debug) console.log( "getStudentSubmissionInfo url:", url );
        pending = 0;
        needsFetched = sections.length;
        fetched = 0;
        getSubmissions( url );
    } else {
        // to generate download
        console.log( 'finished get section submissions info ', sections );
        makeZipFile();
    }
    
    
  }
  
  function getSubmissions( submissionUrl ) { //get peer review data
    let studentId = '';
    let startedTest = 0;
    let finishedTest = 0; 
    try {
      if (aborted) {
        throw new Error('Aborted');
      }
      
      jQuery("#doing").html( "Fetching submission information <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
      pending++;
      // file  {sortable_name}_{user_id}_{attachment_id}_{display_name}, url 
      $.getJSON(submissionUrl, function (adata, status, jqXHR) {
          let tmpSubmissionAr = adata;
          let tmpFileName = '';
          let url = nextURL(jqXHR.getResponseHeader('Link'));
          let tmpSubmission = '';
          let tmpUserName = '';
          let tmpUserId = '';
          let tmpAttachment_id = '';
          let tmpFileDisplayName = '';
          let tmpObj = '';
          let lateStr = '';
          //store submission attachments and user info
          for ( let i=0; i<tmpSubmissionAr.length;i++ ){
              fetched +=1;
              tmpSubmission = tmpSubmissionAr[i];
              //console.log(tmpSubmissionAr[i]);
              if ( !( 'user' in tmpSubmission ) ){
                    continue;
              }
              tmpUserName = tmpSubmission.user.sortable_name.replace(/[.,\']/g, "").replace(/\s+/g, '').toLowerCase();
              tmpUserId = tmpSubmission.user_id;
              
              //console.log( {tmpUserName} );
              
              if ( 'attachments' in tmpSubmission ){

                for ( let m=0; m< tmpSubmission.attachments.length; m++ ){
                    tmpAttachment_id = tmpSubmission.attachments[m].id;
                    tmpFileDisplayName = tmpSubmission.attachments[m].display_name;
                    try {
                      if ( tmpSubmission.late ){
                        tmpFileName = `${tmpUserName}_LATE_${tmpUserId}_${tmpAttachment_id}_${tmpFileDisplayName}`;
                      }else {
                        tmpFileName = `${tmpUserName}_${tmpUserId}_${tmpAttachment_id}_${tmpFileDisplayName}`;
                      }
                    } catch(e){
                      tmpFileName = `${tmpUserName}_${tmpUserId}_${tmpAttachment_id}_${tmpFileDisplayName}`;
                    }
                    
                    //console.log( {tmpFileName } );
                    //tmpObj = { "filename":tmpFileName, 'url':tmpSubmission.attachments[m].url.replace( 'download_frd', 'download' ) };
                    tmpObj = { "filename":tmpFileName, 'url':tmpSubmission.attachments[m].url };
                    sections[sectionIndex].files.push( tmpObj );
                }
              }


          } // end for

          if (url && !finishedTest) {
            
            getSubmissions( url );
          } else {
            
            // get next section submission info
            getStudentSubmissionInfo();
              
              //makeZipFile( courseId, assignmentId );
          
          }
      }).fail(function () {
          
          fetched+=1;
          getStudentSubmissionInfo();
          //makeZipFile( courseId, assignmentId );
          
          if (!aborted) {
            console.log('Some report data failed to load');
          }
      });
    } catch (e) {
      errorHandler(e);
    }

  }

  function makeZipFile( ) { //generates CSV of data
    downloadSectionIndex +=1;
    errMessage = '';
    if ( downloadSectionIndex < sections.length ) {
        getSectionFiles();
    } else {
      progressbar();
      resetData();
    }
  }

  function fetchContent(zip){
    fileIndex +=1;
    let tmpSection = sections[ downloadSectionIndex ];
    if ( tmpSection.files.length==0 ){
      makeZipFile();
      return;
    }
    if ( fileIndex < tmpSection.files.length ){
        let tmpFileName = tmpSection.files[fileIndex].filename;
        let tmpUrl = tmpSection.files[fileIndex].url;
        jQuery("#doing").html( `
        Fetching files ${tmpFileName} for ${tmpSection.name}  <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>
        ` );
        progressbar( fileIndex, tmpSection.files.length );
        zip.file(tmpFileName, urlToPromise(tmpUrl, zip), {binary:true});
    } else {

        zip.generateAsync({type:"blob"}, function updateCallback(metadata) {
            //filesFetched +=1;
            //progressbar( filesFetched, needsFetched );
            jQuery("#doing").html( `
              Ziping files for ${tmpSection.name}  <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>
            ` );
            var msg = "progression : " + metadata.percent.toFixed(2) + " %";
            if(metadata.currentFile) {
                msg += ", current file = " + metadata.currentFile;
            }
            console.log( msg );
            $('#jj_progressbar').progressbar('option', 'value', metadata.percent);
            //updatePercent(metadata.percent|0);
        }).then(function callback(blob) {
    
                // see FileSaver.js
                saveAs(blob, tmpSection.name+".zip");
                //download next section files
                makeZipFile();
                //console.log("done !", tmpSection.name );
            }, function (e) {
                errMessage += 'zip eror for ', tmpSection.name + '\n';
                console.log( 'zip eror for ', tmpSection.name  ); 
                sendEmail( errMessage );
                makeZipFile();
            });

    }
  }

  function getSectionFiles(){
    let tmpSection = sections[ downloadSectionIndex ];
    console.log( { tmpSection } );
    let zip = new JSZip();
    let tmpFileName = '';
    let tmpUrl = '';
    let needsFetched = tmpSection.files.length;
    let filesFetched = 0;
    
    //if not to download main lecture section, as it contains most of the students, and that may not be the purpose
    if ( skipMainLectureSection && tmpSection.name.endsWith("L01C") ){
      //skip main section
      makeZipFile();
      return;
    }

    jQuery("#doing").html( `
        Fetching files for ${tmpSection.name}  <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>
        ` );
    fileIndex = -1;
    fetchContent(zip);
    /*
    if ( 'files' in tmpSection && tmpSection.files.length>0){
        //section.files is an array of objects
        for (let i=0;i<tmpSection.files.length;i++){
            
            tmpFileName = tmpSection.files[i].filename;
            tmpUrl = tmpSection.files[i].url;
            console.log(i, needsFetched, tmpFileName, tmpUrl );

            zip.file(tmpFileName, urlToPromise(tmpUrl), {binary:true});
        }
    }*/
    
  }

    function urlToPromise(url, zip) {
        return new Promise(function(resolve, reject) {
            JSZipUtils.getBinaryContent(url, function (err, data) {
                if(err) {
                    errMessage += err + ` url:${url}\n`;
                    console.log('urlToPromise error:', url);
                    reject(err);
                    fetchContent(zip);
                } else {
                    resolve(data);
                    fetchContent(zip);
                    //console.log( 'urlToPromise success:', url );
                }
            });
        });
    }


  function excelDate(timestamp, allDate=0) {
    var d;
    const monthNames = ["January", "February", "March", "April", "May", "June",
         "July", "August", "September", "October", "November", "December" ];

    try {
      if (!timestamp) {
        return '-';
      }
      timestamp = timestamp.replace('Z', '.000Z');
      var dt = new Date(timestamp);
      if (typeof dt !== 'object') {
        return '';
      }
      if (allDate){
        d =  pad(dt.getDate())  + ' ' + monthNames[dt.getMonth()];
      } else {
        d =  pad(dt.getDate())  + ' ' + monthNames[dt.getMonth()] + ' at ' +  pad(dt.getHours()) + ':' + pad(dt.getMinutes());
      }
      
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
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take more than an hour for large courses</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching Files',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#maker-space-quiz-submissions-report').one('click', {
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
    //sectin = [];
    pending = - 1;
    fetched = 0;
    needsFetched = 0;
    sectionIndex = -1;
    downloadSectionIndex = -1;
  }

  
  
  function sendEmail(errmsg) {
    let receiverEmail = '';
    receiverEmail = senderEmail;
    let tmpSectionName = sections[ sectionIndex ].name;
    Email.send({
      Host: "mailhost.auckland.ac.nz",
      Username: senderEmail,
      Password: "",
      To: receiverEmail,
      From: senderEmail,
      Subject: `Download assignment:${tmpSectionName} error`,
      Body: "Download assignment eror:" + errmsg,
    }).then(function (message) {
      console.log("error message email sent successfully")
    });
  }

  function errorHandler(e) {
    $('#override').html( '' );
    console.log(e.name + ': ' + e.message);
  }
})();
