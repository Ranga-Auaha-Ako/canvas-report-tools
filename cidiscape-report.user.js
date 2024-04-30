// ==UserScript==
// @name        Cidi Labs Cidiscape reports download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Grab Cidi Labs Cidiscape data from all batches and generates an excel download 
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/cidiscape-report.user.js
// @match     https://apac.cidiscape.ciditools.com/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @version     0.11
// @grant       none
// ==/UserScript==

// based on code from James Jones' Canvancement https://github.com/jamesjonesmath/canvancement

(function () {
  'use strict';
  // append Canvas jQuery UI css, for dialog style
  $("head").append (
    '<link '
  + 'href="//du11hjcvx0uqb.cloudfront.net/dist/brandable_css/new_styles_normal_contrast/bundles/common-04107f0c72.css" '
  + 'rel="stylesheet" type="text/css">'
);
 
  var batches = []; // make it shorter, just for quicker test purpose
  var batchList = []; //batchList just to record batch id list
  //var batches = [ "231" ]; // make it shorter, just for quicker test purpose
  var batchIndex = -1;
  var courseReportIndex = -1;
  var totalCourseList = [];
  var totalCourses = 0;
  var batchReportIndex = -1;
  var tokenId = getToken();
  //global array to collect reports
  var reportsAr = {};

  var coursesAr = [];
  //get all batches url, use id and title
  var batchesUrl = 'https://apac.cidiscape.ciditools.com/api/institutions/11/batches';
  
  // from batch id to get all courses, pageId from meta.nextPage, seems 10 per page only, bugs if change to other number
  // POST the batchCoursesUrl with data {"columns":["core.title","core.lmsCourseId","core.published","core.lastUpdateDate","core.courseCode","core.sisCourseId"],"filters":[]}
  //
  var batchCoursesUrl = 'https://apac.cidiscape.ciditools.com/api/batches/{batchId}/batch-reports/dynamic?perPage=100&page={pageId}&sortBy=core.title&sortDir=asc&includeMeta=true';
                      // https://apac.cidiscape.ciditools.com/api/batches/20/batch-reports/dynamic?perPage=10&page=1&sortBy=core.title&sortDir=asc&includeMeta=true
  //
  var urlAr = [ 
  'https://apac.cidiscape.ciditools.com/api/courses/{courseId}',
  'https://apac.cidiscape.ciditools.com/api/courses/{courseId}/report'
 ];

  
  
  //
  
  var pending = - 1;
  var fetched = 0;
  var needsFetched = 0;
  var ajaxPool;
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  var debug = 0;
  var debugBatch = 0;
  var debugReport = 0;
  var debugDate = 0;
  
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  //courseId = getCourseId();
 // quizId = getQuizId(); 
  getBatches()
  today = (yyyy-2000 ) + '-' + mm  + '-' + dd + '-' + Math.floor(Date.now() /1000) ;
  var aborted = false;
  $( document ).ready( function(){addDownloadReportButton();}  );

  function addDownloadReportButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {
        if ( tokenId!=null ){
            if ($('#download-report').length === 0) {
                $('.css-e4i4eu-truncateList-appNav__list').append('<li class="css-166z3xu-truncateList__listItem"><button class="css-13npier-view--flex-item" dir="ltr" id="download-report" cursor="pointer" class="css-d1pl8m-view--flex-item"><span class="css-1f9ldn1-item__label">Download All Reports</span></button></li>');
                
                $('#download-report').one('click', {
                  type: 1
                }, allReports);
            }
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
  function getBatches(){
    $.ajaxSetup({
        headers: { 'x-auth-token': tokenId }
        ,timeout: 15000
    });
    $.getJSON(batchesUrl, function (udata, status, jqXHR) {
        if (debug) console.log( {udata} );
        //batches is an array of batch objects, id, title
        batches = udata; 
      }).fail(function () {
        
        throw new Error('Failed to load report');
      });
  }

  function allReports(e) { //gets the student list
    pending = 0;
    fetched = 0;
    aborted = false;
    setupPool();
     
    progressbar();
    pending = 0;
    needsFetched = batches.length;
    //initialize batchIndex to start from 0 to fetch report of each batch
    batchIndex = -1;
    getBatch( );
    
  }

  function getBatch(){
    
    batchIndex++;
    fetched++;
    progressbar( fetched, needsFetched );
    if (debug) console.log( "getting ", {batchIndex});
    if (aborted) {
        throw new Error('Aborted');
    }
    jQuery("#doing").html( "Fetching informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
    if ( batchIndex< batches.length ) {
    //if ( batchIndex< 1 ) {
        let batchId = batches[batchIndex].id;
        if (debug) console.log( { batchId } );
        batchList.push( batchId );
        let batchObj = {}
        batchObj.id = batchId; 
        batchObj.courses = [];
           
        coursesAr.push( batchObj );
        
        getBatchCourses( batchId, 1 );
    } else {
      //get courses in each batch done
      if (debug) console.log( 'get batches finished' );
      //console.log( coursesAr );
      
      totalCourseList = [...new Set(totalCourseList)];
      if (debug) console.log( totalCourseList );
      //get batch finished, now go to get coruse reports in each batch
      fetched = 0;
      totalCourses = totalCourseList.length;
      courseReportIndex = -1;
      fetchCoursesReport();
    }
    
  }

  function fetchCoursesReport(){
    //getting course report in each batch
    courseReportIndex++;
    fetched++;
    let tmpCourse='';
    progressbar( fetched, totalCourses );
    if (debug) console.log( "getting ", {courseReportIndex});
    if (aborted) {
        throw new Error('Aborted');
    }
    jQuery("#doing").html( "Fetching course report<img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );

    if ( courseReportIndex< totalCourses ) {
        
      let tmpCourseId = totalCourseList[courseReportIndex];
      if (debug) console.log( {tmpCourseId} );
      getCourseReport( tmpCourseId );

    } else {
      if (debug) console.log( 'get all course reports finished' );
      if (debug) console.log( reportsAr );
      
      //get batch finished, now go to get coruse reports in each batch
      fetched = 0;
      generateReports();
      //getBatchReport();
    }
  }

  function getCourseReport( courseid ){
    //get the report of individual course
    let tmpUrl = `https://apac.cidiscape.ciditools.com/api/courses/${courseid}/report`;
    if (debug) console.log( "getCourseReport url:", tmpUrl  );
    let result = {};
    $.getJSON(tmpUrl, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      //push result to reportAr
      reportsAr[courseid] = udata ;
      //get next course report
      fetchCoursesReport();
    }).fail(function () {
      //fetch next course report
      fetchCoursesReport();
      //throw new Error('Failed to load report');
    });
    
  }
  
  //get the number of courses in a batch
  function getBatchCourses(batchId, pageId=''){
    let tmpData = '{"columns":["core.title","core.lmsCourseId","core.published","core.lastUpdateDate","core.courseCode","core.sisCourseId"],"filters":[]}';
    let tmpUrl = batchCoursesUrl.replace('{batchId}', batchId ).replace('{pageId}', pageId );
    if (debug) console.log( "in getBatchCourses", {batchId}, {pageId}, tmpUrl ); 

    jQuery.post( 
      tmpUrl, 
      tmpData, 
      function(udata) {
        if (debug) console.log( {udata} );
        if ( udata.data ) {
          let tmpCourses = udata.data;
          if (debug) console.log( batchId, tmpCourses, udata.meta.nextPage );
          //core.id is the course id in cidiscape to pull report
          //coursesAr[batchIndex].courses.push( ...tmpCourses );
          for ( let i=0;i<tmpCourses.length;i++){
            totalCourseList.push( tmpCourses[i]["core.id"] );
          }
          
          //totalCourses += tmpCourses.length;
          
        }
        //if not all courses yet, get another list
        if (udata.meta.nextPage){
            getBatchCourses( batchId, udata.meta.nextPage );
        } else{ // all courses finished, get another batch
            getBatch();
        }
    }, 'json' ).fail(function() {
        getBatch();
        throw new Error(`Failed to load batch ${batchId}`);
    });
    
  }

  

 
 
  function getToken() { //identifies course ID from URL
    let tokenId = null;
    if (debug) console.log( "in getToken: window.location", window.location.href );
    try {
      
      let matches = window.location.href.split('auth_token=');
      if (debug) console.log(matches);
      if (matches) {
        tokenId = matches[1];
        if (debug) console.log(tokenId);
      } else {
        throw new Error('Unable to detect Course ID');
      }
    } catch (e) {
     errorHandler(e);
    }
    return tokenId;
  }

  function generateReports() {
    
    
    try {
      if (aborted) {
        console.log('Process aborted');
        aborted = false;
        return;
      }
      progressbar();

      var wb = XLSX.utils.book_new();
      wb.Props = {
        Title: "Cidiscape Reports",
        Subject:"Cidiscape Reports",
        Author: "",
        CreatedDate: new Date()
      };
      //save each reportDates into worksheet
      // var animalWS = XLSX.utils.json_to_sheet(this.Datas.animals);
      //XLSX.utils.book_append_sheet(wb, animalWS, 'animals');
      //Generate Reports tab, reportsAr, array of objects
      // date, errors, suggestions, content fixed, content resolved, courses
      let reportData = genReportsAr();
      let tmpWs = XLSX.utils.json_to_sheet( reportData  );
      let titleAr = [
        "Title", 
        "LMS Course Id", 
        "Published", 
        "Last updated", 
        "Last Scan", 
        "Error Count", 
        "Suggestion Count", 
        "Issues Fixed", 
        "Issues Manually Resolved", 
        "% of issues resolved", 
        "Files Reviewed", 
        "% of files reviewed" ];
      XLSX.utils.sheet_add_aoa( tmpWs, [titleAr], { origin: "A1" });
      XLSX.utils.book_append_sheet( wb, tmpWs, "Reports" );

      
      let wbout = XLSX.write(wb, {bookType:'xlsx',  type: 'binary'});
      let blob = new Blob([ s2ab(wbout) ], {
        'type': 'application/octet-stream'
      });

      let savename = 'Cidiscape Reports' +'-' + today + '.xlsx';
      saveAs(blob, savename);

      $('#download-report').one('click', {
        type: 1
      }, allReports);
      resetData();


    } catch (e) {
      errorHandler(e);
    }
  }
  
  function genReportsAr(){
    
    
    let reportObj;
    let reportData = [];
    let tmpReportData={};
    let tmpObj; 
    let tmpIndex;
    let tmpTitle,
        tmpLmsCourseId,
        tmpPublished,
        tmpPublishDate,
        tmpLastScaned,
        tmpErrorCount,
        tmpSuggestedCount,
        tmpIssuesFixed,
        tmpIssueResolved,
        tmpResolvedPercent,
        tmpFilesReviewed,
        tmpFileResolvedPercent;
    ////for ( let k=0; k < reportsAr.length;k++ ){
    for ( [tmpIndex, tmpObj ] of Object.entries(reportsAr)) {
      console.log( {tmpObj} );
      tmpTitle = tmpObj.core["core.courseCode"];
      
      tmpLmsCourseId = tmpObj.core["core.lmsCourseId"];
      tmpLmsCourseId = tmpLmsCourseId.toString();
      tmpPublished = tmpObj.core["core.published"]?"Yes":"No";
      tmpPublishDate = tmpObj.core["core.lastUpdateDate"];
      tmpLastScaned = tmpObj.udoit["udoit.last_scan_date_udoit"];
      tmpErrorCount = tmpObj.udoit["udoit.error_count"];
      tmpSuggestedCount = tmpObj.udoit["udoit.suggestion_count"];
      tmpIssuesFixed = tmpObj.udoit["udoit.issue_fix_count"];
      tmpIssueResolved = tmpObj.udoit["udoit.issue_resolve_count"];
      tmpResolvedPercent = tmpObj.udoit["udoit.issue_resolve_percent"];
      tmpFilesReviewed = tmpObj.udoit["udoit.file_review_count"];
      tmpFileResolvedPercent = tmpObj.udoit["udoit.file_review_percent"];
      if ( tmpLmsCourseId ) {
        tmpReportData[tmpLmsCourseId] = {};
        tmpReportData[tmpLmsCourseId].title = tmpTitle;
        tmpReportData[tmpLmsCourseId].lmsCourseId = tmpLmsCourseId;
        tmpReportData[tmpLmsCourseId].published = tmpPublished;
        tmpReportData[tmpLmsCourseId].publishDate = tmpPublishDate;
        tmpReportData[tmpLmsCourseId].lastScaned = tmpLastScaned ;
        tmpReportData[tmpLmsCourseId].errorCount = tmpErrorCount;
        tmpReportData[tmpLmsCourseId].suggestedCount = tmpSuggestedCount;
        tmpReportData[tmpLmsCourseId].issuesFixed = tmpIssuesFixed;
        tmpReportData[tmpLmsCourseId].issuesResolved = tmpIssueResolved;
        tmpReportData[tmpLmsCourseId].issuesResolvedPercent = tmpResolvedPercent;
        tmpReportData[tmpLmsCourseId].filesReviewed = tmpFilesReviewed;
        tmpReportData[tmpLmsCourseId].fileResolvedPercent = tmpFileResolvedPercent;
        //if (debugDate) console.log( {reportDates} );
      } 
        
        
      reportData.push( tmpReportData[tmpLmsCourseId] ); 
      if (debugReport) console.log( { reportData } );
      
    } // end for reportsAr
    
    
    //reportData.sort((a, b) => (a.date > b.date) ? -1 : 1);
    return reportData;
  }
  
  
//////////////////////////
  // generate fileIssue arry for spreadsheet
 

  
  function camel2title(text) {
    const result = text.replace(/([A-Z])/g, " $1");
    const finalResult = result.charAt(0).toUpperCase() + result.slice(1);
    return finalResult;
  }
    ////////////////////////
  function formateDate(dateStr) {
    var d;
    let tmpAr, tmpM, tmpD, tmpY;
    try {
      if (!dateStr) {
        return '';
      }
      //dateStr 5/1/23 => 05/01/23
      tmpAr = dateStr.split('/');
      tmpM = tmpAr[0];
      tmpD = tmpAr[1];
      tmpY = tmpAr[2];
      d = pad(tmpM) + '/' + pad(tmpD) + '/' + tmpY;
      //d = pad(1 + dt.getMonth()) + '/' + pad(dt.getDate()) + '/' + dt.getFullYear() +  ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());

      //d = ""+ pad(dt.getFullYear()-2000)+ '-' +  pad(1 + dt.getMonth())+ '-' +  pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
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
          $('body').append('<div id="jj_progress_dialog" ></div>');
          $('#jj_progress_dialog').append('<div id="jj_progressbar"></div><small>It may take a few mins to generate the report</small><br><small id="doing"></small>');
          $('#jj_progress_dialog').dialog({
            'title': 'Fetching reports',
            'autoOpen': false,
            'buttons': [
              {
                'text': 'Cancel',
                'click': function () {
                  $('#quiz-submissions-report').one('click', {
                    type: 2
                  }, allReports);
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
    
    pending = - 1;
    batchIndex = -1;
    fetched = 0;
    needsFetched = 0;
    reportsAr = [];
    coursesAr = [];
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

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }
}) ();

