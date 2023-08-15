// ==UserScript==
// @name        UDOIT reports download
// @author      WenChen Hol
// @namespace   https://github.com/clearnz/canvas-report-tools/
// @description Grab udoit admin data from all semesters and generates a .CSV download 
// @downloadURL https://github.com/clearnz/canvas-report-tools/raw/master/udoit-report.user.js
// @include     https://*.ciditools.com/admin*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/filesaver.js
// @require     https://flexiblelearning.auckland.ac.nz/javascript/xlsx.full.min.js
// @version     0.4
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

  
  // to combine 2022, 2023: term id: 234, 231, 230, 243, 241

  var terms = {
    "243": "2023 Semester One",
    "242": "2023 Academic Year Term",
    "241": "2023 Quarter One",  
    "234": "2022 Semester Two",
    "244": "2023 Quarter Two",
    "240": "2023 Summer School",
    "245": "2023 Semester Two",
    "231": "2022 Semester One",
    "230": "2022 Summer School",
    "247": "2023 Quarter Four",
    "246": "2023 Quarter Three",
    "250": "2024 Summer School",
    "228": "2022 Academic Year Term",
    "248": "2023 Doctoral Academic Year",
    "251": "2024 Quarter One",
    "235": "2022 Quarter Three"
} ;
  //var termsAr = [ "230", "231", "234", "241", "243" ];
  //var termsAr = [ "1","71","106", "108","111", "217", "218", "222", "228", "230", "231", "234","235","240", "241", "243","244", "245","246","247","248","250","251" ]; // make it shorter, just for quicker test purpose
  var termsAr = [ "1", "230", "231", "234","235","240", "241", "243","244", "245","246","247","248","250","251" ]; // make it shorter, just for quicker test purpose
  //var termsAr = [ "231" ]; // make it shorter, just for quicker test purpose
  var termIndex = -1;
  var tokenId = getToken();
  //global array to collect reports, issues, file_issues, actions
  var reportsAr = [];
  var issuesAr = [];
  var file_issuesAr = [];
  var actionsAr = [];
  var coursesAr = [];
  //
  var urlAr = [ 
  'https://udoit3.ciditools.com/api/admin/reports/account/1/term/{termId}?subaccounts=true',
  'https://udoit3.ciditools.com/api/admin/issues/account/1/term/{termId}?subaccounts=true',
  'https://udoit3.ciditools.com/api/admin/file_issues/account/1/term/{termId}?subaccounts=true',
  'https://udoit3.ciditools.com/api/admin/file_actions/account/1/term/{termId}?subaccounts=true',
  'https://udoit3.ciditools.com/api/admin/courses/account/1/term/{termId}?subaccounts=true' 
 ];

  var faculties = {"Humanities":"Arts",
  "Social Sciences":"Arts",
  "Cultures, Languages and Linguistics":"Arts",
  "Humanities":"Arts",
  "Applied Language Studies and Linguistics":"Arts",
  "Māori and Pacific Studies":"Arts",
  "Accounting and Finance":"Business and Economics",
  "Architecture and Planning":"Creative Arts and Industries",
  "Biological Sciences":"Science",
  "Chemical and Materials Engineering":"Engineering",
  "Chemical Sciences":"Science",
  "Civil and Environmental Engineering":"Engineering",
  "Commercial Law":"Business and Economics",
  "Computer Science":"Science",
  "Counselling, Human Services and Social Work":"Arts",
  "Critical Studies in Education":"Education",
  "Curriculum and Pedagogy":"Education",
  "Dance Studies Programme":"Creative Arts and Industries",
  "Economics":"Business and Economics",
  "Electrical and Computer Engineering":"Engineering",
  "Engineering":"Engineering",
  "Engineering Science":"Engineering",
  "Environment":"Science",
  "Exercise Sciences":"Science",
  "Faculty Administration Education":"Education",
  "Faculty Administration Medical and Health Sciences":"FMHS",
  "Fine Arts":"Creative Arts and Industries",
  "Information Systems and Operations Management":"Business and Economics",
  "Law":"Law",
  "Learning Development and Professional Practice":"Education",
  "Management and International Business":"Business and Economics",
  "Marine Science":"Science",
  "Marketing":"Business and Economics",
  "Mathematics":"Science",
  "Mechanical Engineering":"Engineering",
  "Medical Sciences":"FMHS",
  "Medicine":"FMHS",
  "Music":"Creative Arts and Industries",
  "Nursing":"FMHS",
  "Pharmacy":"FMHS",
  "Physics":"Science",
  "Population Health":"FMHS",
  "Property":"Business and Economics",
  "Psychology":"Science",
  "Social Sciences":"Arts",
  "Statistics":"Science",
  "Te Kupenga Hauora Maori":"FMHS",
  "Te Puna Wananga":"Education"};
  
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
  var debugDate = 0;
  var debugReport = 0;
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
  $( document ).ready( function(){addDownloadReportButton();}  );

  function addDownloadReportButton() {

    //https://canvas.auckland.ac.nz:443/api/v1/courses/29897/quizzes/25662/submissions?include[]=user
      //try {
        if ( tokenId!=null ){
            if ($('#download-report').length === 0) {
                $('.css-e4i4eu-truncateList-appNav__list').append('<li class="css-d1pl8m-view--flex-item"><button dir="ltr" id="download-report" cursor="pointer" class="css-d1pl8m-view--flex-item"><span class="css-1f9ldn1-item__label">Download 2022/23/24 Reports</span></button></li>');
                
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

  function allReports(e) { //gets the student list
    pending = 0;
    fetched = 0;
    aborted = false;
    setupPool();
     
    progressbar();
    pending = 0;
    needsFetched = termsAr.length * urlAr.length;
    getReport( );
    
  }

  function getReport(){
    
    termIndex++;
    if (debug) console.log( "getting ", {termIndex});
    if ( termIndex< termsAr.length ) {
        let termId = termsAr[termIndex];
        if (debug) console.log( { termId } );
        getTerm( termId );
    } else {
      if (debug) console.log( {reportsAr} );
      if (debug) console.log( {actionsAr} );
      if (debug) console.log( {issuesAr} );
      if (debug) console.log( {file_issuesAr} );
      if (debug) console.log( {coursesAr} );
      //deal with report
      //each report array in own worksheet
      generateReports();
    }
    
  }

  function getTerm( termId ) { //cycles through the course list
    
    if (aborted) {
      throw new Error('Aborted');
    }
    jQuery("#doing").html( "Fetching informaton <img src='https://flexiblelearning.auckland.ac.nz/images/spinner.gif'/>" );
    
    $.ajaxSetup({
      headers: { 'x-auth-token': tokenId }
      ,timeout: 15000
    });
  
  
    getReports( termId );
    
    
  }

  function getReports( termId ){
    let url = urlAr[0].replace('{termId}', termId );
    fetched++;
    progressbar( fetched, needsFetched );
    $.getJSON(url, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      if ( udata.data ) {
        let reports = udata.data.reports;
        //console.log( reports );
        //assign term id for each report object
        for ( let i=0; i<reports.length; i++ ){
          reports[i].term = termId;
        }
        reportsAr.push( reports );
      }
      
      getIssues( termId );
    }).fail(function () {
      getIssues( termId );
      throw new Error('Failed to load report');
    });
  
  }

  function getIssues( termId ){
    let url = urlAr[1].replace('{termId}', termId );
    fetched++;
    progressbar( fetched, needsFetched );
    $.getJSON(url, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      if ( udata.data ) {
        let issues = udata.data.issues;
        //console.log( issues );
        issuesAr.push( issues );
      }
      getFileIssues( termId );
    }).fail(function () {
      getFileIssues( termId );
      throw new Error('Failed to load issues');
    })
  }

  function getFileIssues( termId ){
    let url = urlAr[2].replace('{termId}', termId );
    fetched++;
    progressbar( fetched, needsFetched );
    $.getJSON(url, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      if ( udata.data ) {
        let issues = udata.data.issues;
        //console.log( issues );
        file_issuesAr.push( issues );
      }
      getFileActions(termId);
    }).fail(function () {
      getFileActions(termId);
      throw new Error('Failed to load fileIssues');
    });
  }
  function getFileActions(termId){
    let url = urlAr[3].replace('{termId}', termId );
    fetched++;
    progressbar( fetched, needsFetched );
    $.getJSON(url, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      if ( udata.data ) {
        let actions = udata.data.actions;
        //console.log( actions ); // actions is an array
        actionsAr.push( actions );
      }
      getCourses(termId);
    }).fail(function () {
      getCourses(termId);
      throw new Error('Failed to load fileActions');
    });
  }

  function getCourses(termId){
    let url = urlAr[4].replace('{termId}', termId );
    fetched++;
    progressbar( fetched, needsFetched );
    $.getJSON(url, function (udata, status, jqXHR) {
      if (debug) console.log( {udata} );
      if ( udata.data ) {
        let courses = udata.data;
        //console.log( actions ); // actions is an array
        coursesAr.push( courses );
      }
      getReport();
    }).fail(function () {
      getReport();
      throw new Error('Failed to load fileActions');
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
        Title: "2022/2023/24 UDOIT Reports",
        Subject:"UDOIT Reports",
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
      XLSX.utils.book_append_sheet( wb, tmpWs, "Reports" );

      let issueData = genIssuesAr();
      tmpWs = XLSX.utils.json_to_sheet( issueData  );
      XLSX.utils.book_append_sheet( wb, tmpWs, "Content issues" );
      
      let fileIssueData = genFileIssuesAr();
      tmpWs = XLSX.utils.json_to_sheet( fileIssueData  );
      XLSX.utils.book_append_sheet( wb, tmpWs, "File issues" );
      
      let coursesData = genCoursesAr();
      tmpWs = XLSX.utils.json_to_sheet( coursesData  );
      XLSX.utils.book_append_sheet( wb, tmpWs, "Courses" );
      
      let wbout = XLSX.write(wb, {bookType:'xlsx',  type: 'binary'});
      let blob = new Blob([ s2ab(wbout) ], {
        'type': 'application/octet-stream'
      });

      let savename = '2022/2023 UDOIT Reports' +'-' + today + '.xlsx';
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
    let reportDates = {};
    let maxTermVal = {};
    
    let reportObj;
    let reportData = [];
    let tmpDate;
    let tmpObj; 
    let tmpIndex;
    let tmpTermId;
    //let totalCourses = 0;
    for ( let k=0; k < reportsAr.length;k++ ){
      reportObj = reportsAr[k];
      //if (debugReport) console.log(Object.entries(reportObj)); 
      //for ( [tmpDate, tmpObj ] of Object.entries(reportObj)) {
      for ( [tmpIndex, tmpObj ] of Object.entries(reportObj)) {
        tmpDate = tmpObj.created;
        tmpTermId = tmpObj.term;
        
        if ( ! (tmpDate in reportDates) ) {
          reportDates[tmpDate] = {};
          reportDates[tmpDate].date = tmpObj.created;
          reportDates[tmpDate].errors = tmpObj.errors;
          reportDates[tmpDate].suggestions = tmpObj.suggestions;
          reportDates[tmpDate].contentFixed = tmpObj.contentFixed;
          reportDates[tmpDate].contentResolved = tmpObj.contentResolved;
          reportDates[tmpDate].courses = tmpObj.count;
          //if (debugDate) console.log( {reportDates} );
        } else {
          //console.log( tmpDate, " exist in reportDates" );
          reportDates[tmpDate].errors += tmpObj.errors;
          reportDates[tmpDate].suggestions += tmpObj.suggestions;
          reportDates[tmpDate].contentFixed += tmpObj.contentFixed;
          reportDates[tmpDate].contentResolved += tmpObj.contentResolved;
          reportDates[tmpDate].courses += tmpObj.count;
        }
        //register for last course count and date for each date
        maxTermVal[ tmpTermId ] = tmpObj;
        
        if (debugReport) console.log(tmpDate, reportDates[tmpDate].courses);
      } 
    }
    if (debugDate) console.log( {reportDates}, Object.keys( reportDates ) );
    //sort the reportData
    reportData.sort((a, b) => (a.errors > b.errors) ? -1 : 1);
    let dates = Object.keys( reportDates );
    if (debugReport) console.log( {dates} );
    for ( let k=0; k < dates.length;k++ ){
      let dateitem = dates[k];
      //totalCourses += reportDates[dateitem].courses;
      for ( [tmpIndex, tmpObj ] of Object.entries(maxTermVal)) {
        // if the date exceed term last date, add the max value;
        if (debugReport) console.log( "in report:", tmpObj );
        if ( dateitem > tmpObj.created ){
          reportDates[dateitem].errors += tmpObj.errors;
          reportDates[dateitem].suggestions += tmpObj.suggestions;
          reportDates[dateitem].contentFixed += tmpObj.contentFixed;
          reportDates[dateitem].contentResolved += tmpObj.contentResolved;
          reportDates[dateitem].courses += tmpObj.count;
        }
      }
      ////////////////////////
      //reportDates[dateitem].courses = totalCourses;
      reportData.push( reportDates[dateitem] );
      
    } //  end for dates
    
    //reportData.sort((a, b) => (a.date > b.date) ? -1 : 1);
    return reportData.reverse();
  }
  
  function genIssuesAr(){
    let issueObjects = {};
    let issueObj, tmpObj;
    let issueName, tmpIssue;
    let issueData = [];
    let issueMapping = {
      'Paragraph Not Used As Header':'Paragraph Not Used As Header',
      'Anchor Suspicious Link Text':'Link Has Nondescript Text',
      'Css Text Style Emphasize':'Avoid Using Color Alone for Emphasis',
      'Video Embed Check':'Closed Captions Cannot Be Checked',
      'Table Data Should Have Table Header':'No Table Headers Found',
      'Image Alt Is Different':'Alternative Text Should Not Be the Image Filename' ,
      'Css Text Has Contrast':'Insufficient Text Color Contrast With the Background',
      'Anchor Must Contain Text':'Links Should Contain Text',
      'Headings In Order':'Heading Levels Should Not Be Skipped',
      'Iframe Not Handled': 'External Content May Be Inaccessible',
      'Videos Have Auto Generated Captions': 'Closed Captions Were Auto-Generated',
      'Table Header Should Have Scope':'No Row or Column Scope Declarations Found in Table Headers',
      'Pre Should Not Be Used For Tabular Values':'"Pre" Elements Should Not Be Used for Tabular Data',
      'Video Api Youtube Connection Failed':'Connection to the YouTube service failed',
      'Videos Embedded Or Linked Need Captions':'No Closed Captions Found',
      'Adjacent Links':'Adjacent Links found',
      'Image Has Alt':'Image Elements Should Have an "alt" Attribute',
      'Headers Have Text':'Headings Should Contain Text',
      'Video Captions Match Course Language':'Closed Captions Do Not Match Course Language',
      'Image Alt Not Empty In Anchor':'Alt Text For Images Within Links Should Not Be Empty',
      'Table Not Empty':'Table Without Content Detected',
      'Image Has Alt Decorative':'Decorative Images Should Have Empty Alternative Text',
      'Video Api Vimeo Connection Failed':'Connection to the Vimeo service failed',
      'Image Alt Is Too Long':'Alternative Text Is More Than the Maximum Allowed Characters'
    }
    for ( let k=0; k < issuesAr.length;k++ ){
      issueObj = issuesAr[k];

      for ( [issueName, tmpObj ] of Object.entries(issueObj)) {
        issueName = camel2title( issueName ).trim();
        tmpObj.id = issueName;
        if ( issueName in issueObjects ){
          if (debug) console.log( {issueName}, " in issueObjects", issueObjects[ issueName ]  )
          issueObjects[ issueName ].active = issueObjects[ issueName ].active + tmpObj.active;
          issueObjects[ issueName ].fixed = issueObjects[ issueName ].fixed + tmpObj.fixed;
          issueObjects[ issueName ].resolved = issueObjects[ issueName ].resolved + tmpObj.resolved;
          issueObjects[ issueName ].courses = issueObjects[ issueName ].courses + tmpObj.courses;
          issueObjects[ issueName ].total = issueObjects[ issueName ].total + tmpObj.total;
          if (debug) console.log( "after add:", issueObjects[ issueName ] );
        } else {
          if (debug) console.log( {issueName}, "not in issueObjects"  )
          issueObjects[ issueName ] = { ...tmpObj };
          
        }
      }
    }
    //console.log( {issueObjects} );
    let issues = Object.keys( issueObjects );
    
    //console.log( {issues} );
    for ( let k=0; k < issues.length;k++ ){
      let issue = issues[k];
      tmpIssue = {};
      
      tmpObj = issueObjects[issue];
      if ( tmpObj.id in issueMapping ) {
        tmpIssue["Issue"] = issueMapping[ tmpObj.id ];
      } else {
        tmpIssue["Issue"] = tmpObj.id;
      }
      
      tmpIssue["Issue Severity"] = tmpObj.type;
      tmpIssue["Active"] = tmpObj.active;
      tmpIssue["Fixed"] = tmpObj.fixed;
      tmpIssue["Resolved"] = tmpObj.resolved;
      tmpIssue["Courses"] = tmpObj.courses;
      tmpIssue["Total"] = tmpObj.total;
      
      ////////////////////////
      issueData.push( tmpIssue );
      
    } //  end for dates
    //order by active number 
    issueData.sort((a, b) => (a.Active > b.Active) ? -1 : 1);
    return issueData;
  }
//////////////////////////
  // generate fileIssue arry for spreadsheet
  function genFileIssuesAr(){
    let fileIssueObjects = {};
    let fileIssueObj;
    let fileIssueName;
    let fileIssueData = [];
    let tmpFileIssue;
    let tmpObj;
    let pdfIssueMapping = {
      'file.pdf.structure':'PDF - Missing Structure',
      'file.pdf.tags':'PDF - Untagged File',
      'file.pdf.notags':'PDF - Untagged File',
      'file.pdf.invalid':'PDF - Processing Error',
      'file.pdf.scanned':'PDF - Scanned File',
      'file.doc.old':'DOC - Older File Format' ,
      'file.doc.scanned':'DOC - Scanned File',
      'file.ppt.scanned':'PPT - Scanned File',
      'file.ppt.old':'PPT - Older File Format',
      'file.html.invalid': 'HTML - Invalid format',
      'file.html.scanned': 'HTML - Scanned File'
    }
    for ( let k=0; k < file_issuesAr.length;k++ ){
      fileIssueObj = file_issuesAr[k];
      
      for ( [fileIssueName, tmpObj ] of Object.entries(fileIssueObj)) {
        if (debug) console.log( "inFileIssues:", { tmpObj });
        fileIssueName = tmpObj.id;
        if ( fileIssueName in fileIssueObjects ){
          if (debug) console.log( {fileIssueName}, " in fileIssueObjects" , fileIssueObjects[ fileIssueName ] );
          fileIssueObjects[ fileIssueName ].courses = fileIssueObjects[ fileIssueName ].courses + tmpObj.courses;
          fileIssueObjects[ fileIssueName ].total = fileIssueObjects[ fileIssueName ].total + tmpObj.total;
          if (debug) console.log( "after add: ", fileIssueObjects[ fileIssueName ] );
        } else {
          if (debug) console.log( {fileIssueName}, " not in fileIssueObjects"  );
          fileIssueObjects[ fileIssueName ] = { ...tmpObj };
          
        }
      }
    }
    //console.log( {fileIssueObjects} );
    let fileIssues = Object.keys( fileIssueObjects );

    //console.log( {fileIssues} );
    for ( let k=0; k < fileIssues.length;k++ ){
      tmpFileIssue = {};
      let fileIssue = fileIssues[k];
      tmpObj = fileIssueObjects[fileIssue];
      if ( tmpObj.id in pdfIssueMapping ) {
        tmpFileIssue["Issue"] = pdfIssueMapping[ tmpObj.id ];
      } else {
        tmpFileIssue["Issue"] = tmpObj.fileType.toUpperCase() + ' - ' + tmpObj.id.replaceAll( '.', ' ');
      }
      
      tmpFileIssue["Courses"] = tmpObj.courses;
      tmpFileIssue["Total"] = tmpObj.total;
      ////////////////////////
      fileIssueData.push( tmpFileIssue );
      
    } //  end for dates
    //order by course number 
    fileIssueData.sort((a, b) => (a.Courses > b.Courses) ? -1 : 1);
    return fileIssueData;
  }

  function genCoursesAr(){
    let coursesData = [];
    let tmpCourses, course;
    //console.log( {coursesAr} );
    //coursesAr is array of array
    for ( let k=0; k < coursesAr.length;k++ ){
      
      let courses = coursesAr[k];
      for ( let i=0; i< courses.length; i++){
        tmpCourses = {};
        course = courses[i];
        tmpCourses["Course Name"] = course.title;
        tmpCourses["Account Name"] = course.accountName;
        tmpCourses["Last Scanned"] = course.lastUpdated;
        tmpCourses["Errors"] = course.report.errors;
        tmpCourses["Suggestions"] = course.report.suggestions;
        tmpCourses["Content Fixed"] = course.report.contentFixed;
        tmpCourses["Content Resolved"] = course.report.contentResolved;
        tmpCourses["Files Reviewed"] = course.report.filesReviewed;
        ////////////////////////
        coursesData.push( tmpCourses );
      }
    } //  end for coursesAr
    //order by course name 
    coursesData.sort((a, b) => (a['Course Name'] > b['Course Name']) ? 1 : -1);


    return coursesData;
  }

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
    termIndex = -1;
    fetched = 0;
    needsFetched = 0;
    reportsAr = [];
    issuesAr = [];
    file_issuesAr = [];
    actionsAr = [];
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

