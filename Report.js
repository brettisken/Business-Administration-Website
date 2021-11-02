import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { withRouter } from 'react-router';
import { auth } from '../Services/Firebase'
import { firestore } from '../Services/Firebase'
import JsPDF from "jspdf";
import "jspdf-autotable";
import 'bootstrap/dist/css/bootstrap.min.css';
import {Button, ButtonGroup} from 'react-bootstrap'

class Report extends React.Component{
    state = {
        startDate: new Date(),
        endDate: new Date(),
        data: null
    }

    async handleLogout(e) {
        e.preventDefault();
        
        /*
        await Auth.logout(() => {
            this.props.history.push("/");
        });*/

        await auth.signOut()
        .then((result) => {
            this.props.history.push("/");
            // ...
        }).catch((error) => {
            console.log("Error: ", error)
        });

    }

    gotoPage (e) {
        e.preventDefault();
        this.props.history.push("/page");
    }

    gotoRecipe (e) {
        e.preventDefault();
        this.props.history.push("/recipe");
    }

  async fetchInventory() {
    if (!this.state.data){ 
        var itemDocs = await firestore.collection("Items").get()
        var items = []
        for(const doc of itemDocs.docs){
            const temp = doc.data()
            temp.id = doc.id
            items.push(temp)
          }
        this.state.data = items
    }
    for (var rowIdx in this.state.data) {
      this.state.data[rowIdx]['startCount'] = this.state.data[rowIdx].Count
      this.state.data[rowIdx]['endCount'] = this.state.data[rowIdx].Count
      this.state.data[rowIdx]['totalCost'] = this.state.data[rowIdx].Cost * this.state.data[rowIdx].Count
    }
    var reportName = 'Consolidated Current Inventory Report'
    this.generateConsolidatedReport(reportName,false)
  }

  async fetchInventoryRange() {
    if (!this.state.data){ 
        var itemDocs = await firestore.collection("Items").get()
        var items = []
        for(const doc of itemDocs.docs){
            const temp = doc.data()
            temp.id = doc.id
            items.push(temp)
          }
        this.state.data = items
    }
    var ref = firestore.collectionGroup('Inventory')
        .where('Date', '>=', Date.parse(this.state.startDate))
        .where('Date', '<=', Date.parse(this.state.endDate))

    var inventory = {}
    await ref.get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
          if (!inventory[doc.data().id]) {
            inventory[doc.data().id] = [doc.data()]
          } else {
            inventory[doc.data().id].push(doc.data())
          }
      });
    })
    
    for (var rowDataIdx in this.state.data) { 
      var id = this.state.data[rowDataIdx].id
      var totalCost = 0
      var maxDate = 0
      var minDate = 9999999999999
      var endCount = 0 
      var startCount = 0 
      for (var rowInventoryIdx in inventory[id]) {
        var inv = inventory[id][rowInventoryIdx] 
        if (inv.Change>0) {
          totalCost = inv.Cost * inv.Change + totalCost
        }
        if (inv.Date > maxDate) {
          maxDate = inv.Date
          endCount = inv.Count
        }
        if (inv.Date < minDate) {
          minDate = inv.Date
          startCount = inv.Count - inv.Change
        }
      }
      this.state.data[rowDataIdx]['startCount'] = startCount
      this.state.data[rowDataIdx]['endCount'] = endCount
      this.state.data[rowDataIdx]['totalCost'] = totalCost
    }
    var reportName = 'Consolidated Range Inventory Report'
    this.generateConsolidatedReport(reportName,true)
  }

    generateConsolidatedReport(reportName,range) {
        var types = {}
        types['Total'] = {endTotal : 0, totalCost : 0, startTotal : 0}
        for (var idx in this.state.data) {
          var type = this.state.data[idx].Type
      
          var allEndCount = types['Total'].endTotal + this.state.data[idx].endCount
          var allStartCount = types['Total'].startTotal + this.state.data[idx].startCount
          var allCost = types['Total'].totalCost + this.state.data[idx].totalCost
          types['Total'] = {endTotal : allEndCount, totalCost : allCost, startTotal : allStartCount}
      
          if (!types[type]) {
            types[type] = {endTotal : this.state.data[idx].endCount, totalCost : this.state.data[idx].totalCost, startTotal : this.state.data[idx].startCount}
          } else {
            var endTotal = types[type].endTotal + this.state.data[idx].endCount
            var totalCost = types[type].totalCost + this.state.data[idx].totalCost
            var startTotal = types[type].startTotal + this.state.data[idx].startCount
            types[type] = {endTotal : endTotal, totalCost : totalCost, startTotal : startTotal}
          }
        }

        var reportRows = []
        for (var key in types) {
          if (key === 'Total') {
            var total = [key,types[key].startTotal,types[key].endTotal,types[key].totalCost]
          } else {
            var row = [key,types[key].startTotal,types[key].endTotal,types[key].totalCost]
            reportRows.push(row)
          } 
        }
        var day = this.state.startDate.getDate();
        var month = this.state.startDate.getMonth() + 1;
        var year = this.state.startDate.getFullYear();
        var start = month + '/' + day + '/' + year
        day = this.state.endDate.getDate();
        month = this.state.endDate.getMonth() + 1;
        year = this.state.endDate.getFullYear();
        var end = month + '/' + day + '/' + year
      
        const headerNames = ['Type','Starting Inv Count','Ending Inv Count','Total Cost']
        const doc = new JsPDF();
        doc.text('Braeloch Brewing',14,25)
        doc.text(reportName,14,32)
        if (range) {
          doc.text(start + ' - ' + end,14,39)
        } else {
          var date = new Date()
          doc.text((date.getMonth()+1) + '/' + (date.getDate()) + '/' + (date.getFullYear()),14,39)
        }
        doc.autoTable({
          head: [headerNames],
          body: reportRows,
          margin: { top: 20 },
          startY: 40,
          foot: [total],
          styles: {
            minCellHeight: 9,
            halign: "left",
            valign: "center",
            fontSize: 8,
          },
        });
        doc.output('pdfobjectnewwindow','report.pdf');
    }

    handleColor(time) {
        return time.getHours() > 12 ? "text-primary" : "text-success";
    };

    render(){
        return(
            <div>
                <h2>Reports</h2>
                <ButtonGroup className="mr-2" aria-label="Second group">
                <DatePicker showTimeSelect timeClassName={(time)=> this.handleColor(time)} selected={this.state.startDate} onChange={value => this.setState({startDate: value})} />
                <br/>
                <DatePicker showTimeSelect timeClassName={(time)=> this.handleColor(time)} selected={this.state.endDate} onChange={value => this.setState({endDate: value})} />
                </ButtonGroup >
                <br/>
                <ButtonGroup className="mr-2" aria-label="Second group">
                <button className="btn-primary m-1" variant="primary" onClick={()=>this.fetchInventory()}>
                    Consolidated Current Inventory Report
                </button>
                <button className="btn-primary m-1" variant="primary" onClick={()=>this.fetchInventoryRange()}>
                    Consolidated Range Inventory Report
                </button>
                </ButtonGroup>
            </div>
        );
    }
}

export default withRouter(Report)