window.onload = function() {
    $(".datepicker").datepicker();

    var packageName = $("#package-name");
    var npmTrendForm = $("#npm-trend-form");
    var packageToTrack = $("#package-to-track");
    var startDate = $("#start-date");
    var endDate = $("#end-date");
    var errorDom = $("#error-text");
    var NPM_API_URL = "https://api.npmjs.org/downloads/range/";
    var NPM_DATE_FORMAT = "yy-mm-dd";
    
    var dataOptions = [];
    var chartOptions = {
        theme: "light2",
        animationEnabled: true,
        title: {
            text: "NPM Download Stats",
            padding: 10,
            fontFamily: "'Lato', sans-serif"
        },
        axisX: {
            crosshair: {
                enabled: true,
                snapToDataPoint: true
            }
        },
        legend: {
            cursor: "pointer",
            fontFamily: "'Lato', sans-serif",
            itemclick: function (e) {
                if (typeof (e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
                    e.dataSeries.visible = false;
                } else {
                    e.dataSeries.visible = true;
                }
                visibleOptions.removeClass("active");
                e.chart.render();
            }
        },
        toolTip: {
            shared: true,
            contentFormatter: function(e) {
                var content = " ", total = 0;
                content += CanvasJS.formatDate(e.entries[0].dataPoint.x, "MMM DD YYYY") + "<br/>";
                if(e.entries.length > 1)
                    for (var i = 0; i < e.entries.length; i++) {
                        total += e.entries[i].dataPoint.y;
                    }
				for (var i = 0; i < e.entries.length; i++) {
					content += "<span style='color:" + e.entries[i].dataSeries.color + ";'>" + e.entries[i].dataSeries.name + "</span> " + e.entries[i].dataPoint.y + (e.entries.length > 1 && total != 0 ? (" (" + parseFloat((e.entries[i].dataPoint.y / total) * 100).toFixed(2) + "%)") : "");
					content += "<br/>";
				}
                content += e.entries.length > 1 ? ("Total: " + total + "<br/>") : "";
				return content;
            }
        },
        data: dataOptions
    }
    var chart;

    startDate.datepicker("setDate", "-1m")
    endDate.datepicker("setDate", "-1")

    npmTrendForm.on("submit", formSubmit);

    var packageList = localStorage.getItem("packageList");
    if(packageList) {
        packageList = JSON.parse(packageList);
        getAllPackageStats(true);
    } else {
        packageList = [];
    }   

    async function getAllPackageStats(initial) {
        await Promise.all(packageList.map(async (pkg) => {
            initial && packageToTrack.append(packageCard(pkg).dom())
            dataOptions.push({
                type: "spline",
                name: pkg,
                showInLegend: true,
                xValueFormatString: "DD MMM, YY DDD",
                dataPoints: []
            });
            await getPackageData(pkg);
        }));
        drawChart();
    }

    function formatDateforNPM(dateStr) {
        return $.datepicker.formatDate(NPM_DATE_FORMAT, new Date(dateStr));
    }

    async function getPackageData(packageName) {
        let npmResponse = await fetch( `${NPM_API_URL}${formatDateforNPM(new Date(startDate.val()))}:${formatDateforNPM(new Date(endDate.val()))}/${encodeURIComponent(packageName)}` );
        if(npmResponse.status != 200) 
            throw new Error(`Response from NPM is ${npmResponse.status}`);
        let npmResponseData = await npmResponse.json();
        let data = dataOptions.filter(data => data.name === packageName);
        if(data.length == 0) {
            data[0] = dataOptions[dataOptions.push({
                type: "spline",
                name: packageName,
                showInLegend: true,
                xValueFormatString: "DD MMM, YY dd",
                dataPoints: []
            }) - 1];
        }
        data[0].dataPoints = npmResponseData.downloads.map(data => ({ y: data.downloads, x: new Date(data.day)}))
    }

    function showError(errorMessage) {
        errorDom.text(errorMessage);
        $('.collapse').collapse('show')
    }

    function hideError() {
        $('.collapse').collapse('hide')
    }

    async function formSubmit(e) {
        // prevent refreshing the page
        e.preventDefault();
        var packageElement =  packageCard(packageName.val())
        
        if(packageList.filter((pkgName) => packageName.val() === pkgName).length > 0) {
            showError("Package already exists");
            return;
        } 
        
        if(packageName.val() == "") {
            getAllPackageStats();
            return;
        }
        
        try {
            await getPackageData(packageName.val());
            drawChart();
            packageList.push(packageName.val());
            localStorage.setItem("packageList", JSON.stringify(packageList));
            packageToTrack.append(packageElement.dom());
            packageName.val("");
            hideError();
        } catch(e) {
            showError(e);
        }
    }

    function packageCard(name) {
        var packageName = name;
        return {
            dom: function() {
                var container = document.createElement("div");
                container.classList.add("border", "border-light", "shadow-sm", "mx-2", "p-2", "bg-white", "rounded", "flex-row", "flex")
                var icon = document.createElement("i");
                icon.classList.add("bi", "bi-x-lg", "ms-2", "cursor-pointer", "float-right");
                container.appendChild(document.createTextNode(packageName));
                container.setAttribute("data-package-name", packageName);
                container.appendChild(icon);
                return container;
            },
            getPackageName: function() {
                return packageName;
            }
        }
    }

    packageToTrack.on("click", "i.bi", function(e) {
        var packageCard = e.target.parentElement;
        
        packageList = packageList.filter((pkg) => pkg !== packageCard.getAttribute("data-package-name"));
        chartOptions.data = dataOptions = dataOptions.filter(data => data.name !== packageCard.getAttribute("data-package-name"));
        localStorage.setItem("packageList", JSON.stringify(packageList));
        packageCard.remove();
        drawChart();
    })

    function drawChart() {
        if(chart instanceof CanvasJS.Chart) {
            chart.destroy();
        }
        
        chart = new CanvasJS.Chart("chartContainer", chartOptions);
        chart.render();
    }

    var visibleOptions = $(".visible-options .btn");

    visibleOptions.on("click", function() {
        visibleOptions.removeClass("active");
    });

    $("#showAllSeries").on("click", function(e) {
        !jQuery(e.target).hasClass("active") && jQuery(e.target).addClass("active");
        chart.options.data.forEach(data => {
            data.visible = true;
        })
        chart.render();
    });

    $("#hideAllSeries").on("click", function(e) {
        !jQuery(e.target).hasClass("active") && jQuery(e.target).addClass("active");
        chart.options.data.forEach(data => {
            data.visible = false;
        })
        chart.render();
    });
}