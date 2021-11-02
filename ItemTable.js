import React from 'react'
import 'bootstrap/dist/css/bootstrap.min.css';

import { useTable, useFilters, useGlobalFilter, useAsyncDebounce, useSortBy, usePagination, useRowSelect } from 'react-table'
// A great library for fuzzy filtering/sorting items
import { firestore } from '../Services/Firebase'
import {itemValidation , updateInventory, fetchItems} from './Utils'
import { ButtonToolbar , Form , ButtonGroup, InputGroup, Button} from 'react-bootstrap'
import { v4 as uuidv4 } from 'uuid';

import BTable from 'react-bootstrap/Table';

import { useExportData } from "react-table-plugins";
import Papa from "papaparse";
import JsPDF from "jspdf";
import "jspdf-autotable";

// Create an editable cell renderer
const EditableCell = ({
  value: initialValue,
  row: { index },
  column: { id },
  updateData, // This is a custom function that we supplied to our table instance
}) => {
  //stops a warnning message if initialValue is a bad value
  if (!initialValue) {
    initialValue = ""
  }
  // We need to keep and update the state of the cell normally
  const [value, setValue] = React.useState(initialValue)

  const onChange = e => {
    setValue(e.target.value)
  }

  // We'll only update the external data when the input is blurred
  const onBlur = () => {
    var validated = itemValidation(value,id);
    if (validated[0]) {
      setValue(validated[1])
      updateData(index, id, validated[1])
    } else {
      setValue(initialValue)
    }
  }

  // If the initialValue is changed external, sync it up with our state
  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return <input className="form-control input-lg border-50" value={value} onChange={onChange} onBlur={onBlur} />
}

const defaultColumn = {
  Cell: EditableCell,
}

function getExportFileBlob({ columns, data, fileType, fileName }) {
  console.log('expoirt')
  if (fileType === "csv") {
    // CSV example
    const headerNames = columns.map((col) => col.exportValue);
    const csvString = Papa.unparse({ fields: headerNames, data });
    return new Blob([csvString], { type: "text/csv" });

  } else if (fileType === "pdf") {
    const headerNames = columns.map((column) => column.exportValue);
    const doc = new JsPDF();
    doc.autoTable({
      head: [headerNames],
      body: data,
      margin: { top: 20 },
      styles: {
        minCellHeight: 9,
        halign: "left",
        valign: "center",
        fontSize: 8,
      },
    });
    doc.save(`${fileName}.pdf`);
    return false;
  }
  return false;
}



// Define a default UI for filtering
function GlobalFilter({
preGlobalFilteredRows,
globalFilter,
setGlobalFilter,
}) {
const count = preGlobalFilteredRows.length
const [value, setValue] = React.useState(globalFilter)
const onChange = useAsyncDebounce(value => {
  setGlobalFilter(value || undefined)
}, 200)

return (
  <span>
    <input 
      className="form-control input-lg border-50"
      value={value || ""}
      onChange={e => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      placeholder={`Search: ${count} records...`}
    />
  </span>
)
}

const IndeterminateCheckbox = React.forwardRef(
({ indeterminate, ...rest }, ref) => {
  const defaultRef = React.useRef()
  const resolvedRef = ref || defaultRef

  React.useEffect(() => {
    resolvedRef.current.indeterminate = indeterminate
  }, [resolvedRef, indeterminate])

  return <input className="ml-2" type="checkbox" ref={resolvedRef} {...rest} />
}
)

// Our table component
// Be sure to pass our updateMyData and the skipPageReset option
function Table({ columns, data, updateData, skipPageReset , deleteRows, saveChanges, addItem, resetChanges}) {
const {
  getTableProps,
  getTableBodyProps,
  headerGroups,
  rows,
  prepareRow,
  state,
  visibleColumns,
  preGlobalFilteredRows,
  setGlobalFilter,
  allColumns,
  getToggleHideAllColumnsProps,
  selectedFlatRows,
  state: { selectedRowIds },
  exportData,
  page, // Instead of using 'rows', we'll use page,
  // which has only the rows for the active page

  // The rest of these things are super handy, too ;)
  canPreviousPage,
  canNextPage,
  pageOptions,
  pageCount,
  gotoPage,
  nextPage,
  previousPage,
  setPageSize,
  state: { pageIndex, pageSize },
} = useTable(
  {
    columns,
    data,
    defaultColumn, // Be sure to pass the defaultColumn option
    initialState: { pageIndex: 0 },
    initialState: { pageSize: 50 },
    // use the skipPageReset option to disable page resetting temporarily
    autoResetPage: !skipPageReset,
    autoResetSortBy: false,
    autoResetGlobalFilter: false,
    getExportFileBlob,
    // updateMyData isn't part of the API, but
    // anything we put into these options will
    // automatically be available on the instance.
    // That way we can call this function from our
    // cell renderer!
    updateData,
    deleteRows,
    saveChanges,
    addItem,
    resetChanges,
  },
  useGlobalFilter, // useGlobalFilter!
  useSortBy,
  usePagination,
  useRowSelect,
  useExportData,
  hooks => {
    hooks.visibleColumns.push(columns => [
      // Let's make a column for selection
      {
        id: 'selection',
        // The header can use the table's getToggleAllRowsSelectedProps method
        // to render a checkbox
        Header: ({ getToggleAllRowsSelectedProps }) => (
          <div>
            <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
          </div>
        ),
        // The cell can use the individual row's getToggleRowSelectedProps method
        // to the render a checkbox
        Cell: ({ row }) => (
          <div>
            <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
          </div>
        ),
      },
      ...columns,
    ])
  }
)

return (
  <>
    <ButtonGroup className="mr-2" aria-label="First group">
      <div >
        <IndeterminateCheckbox {...getToggleHideAllColumnsProps()} />Toggle All
      </div>
      {allColumns.map(column => (
        <div key={column.id}>
          <label>
            <input className="ml-2" type="checkbox" {...column.getToggleHiddenProps()} />
            {column.id}
          </label>
        </div>
      ))}
    </ButtonGroup>  
  <ButtonToolbar aria-label="Toolbar with button groups" style={{display: 'flex', justifyContent: 'center'}}>
    <ButtonGroup className="mr-2" aria-label="Second group">
        <button className="btn-primary m-1" variant="primary" onClick={saveChanges}>Save Changes</button>
        <button className="btn-primary m-1" onClick={resetChanges}>Undo Changes</button>
        <button className="btn-primary m-1" variant="primary" onClick={addItem}>Add Item</button>
        <button className="btn-primary m-1" variant="primary" onClick={()=> {
            if (window.confirm('Are you sure you wish to delete this item?')){
              deleteRows(Object.keys(selectedRowIds))
            }
          }}>
          Delete Items
        </button>
        <button className="btn-primary m-1" variant="primary" onClick={() => {exportData("csv", false);}}>Download CSV</button>
        <button className="btn-primary m-1" variant="primary" onClick={() => {exportData("pdf", false);}}>Download PDF</button>
      </ButtonGroup >
    </ButtonToolbar>
    <BTable striped bordered hover size="sm" {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              // Add the sorting props to control sorting. For this example
              // we can add them into the header props
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {/* Render the columns filter UI */}
                {/* Add a sort direction indicator */}
                <span>
                  {column.isSorted
                    ? column.isSortedDesc
                      ? ' 🔽'
                      : ' 🔼'
                    : ''}
                </span>
               
              </th>
            ))}
          </tr>
        ))}
        <tr>
          <th
            colSpan={visibleColumns.length}
            style={{
              textAlign: 'left',
            }}
          >
            <GlobalFilter
              preGlobalFilteredRows={preGlobalFilteredRows}
              globalFilter={state.globalFilter}
              setGlobalFilter={setGlobalFilter}
            />
          </th>
        </tr>
      </thead>
      <tbody {...getTableBodyProps()}>
        {page.map((row, i) => {
          prepareRow(row)
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => {
                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              })}
            </tr>
          )
        })}
      </tbody>
    </BTable>
         {/* 
      Pagination can be built however you'd like. 
      This is just a very basic UI implementation:
    */}
    <div className="pagination" style={{display: 'flex', justifyContent: 'center'}}>
      <button className="btn-primary" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
        {'<<'}
      </button>{' '}
      <button className="btn-primary" onClick={() => previousPage()} disabled={!canPreviousPage}>
        {'<'}
      </button>{' '}
      <button className="btn-primary" onClick={() => nextPage()} disabled={!canNextPage}>
        {'>'}
      </button>{' '}
      <button className="btn-primary" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
        {'>>'}
      </button>{' '}
      <span>
        Page{' '}
        <strong>
          {pageIndex + 1} of {pageOptions.length}
        </strong>{' '}
      </span>
      <select
        value={pageSize}
        onChange={e => {
          setPageSize(Number(e.target.value))
        }}
      >
        {[10, 25, 50, 75, 100,data.length].map(pageSize => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </select>
    </div>
  </>
)
}

export default function ItemTable(props) {
const columns = React.useMemo(
  () => [
      {
        Header: "Name",
        accessor: "Name"
      },
      {
        Header: "Type",
        accessor: "Type"
      },
      {
        Header: "SubType",
        accessor: "SubType"
      },
      {
        Header: "Serial",
        accessor:  "Serial"
      },
      {
        Header: "Percentage",
        accessor: d => Number(d.Percentage)
      },
      {
        Header: "Year",
        accessor: d => Number(d.Year)
      },
      {
        Header: "Unit",
        accessor: "Unit"
      },
      {
        Header: "Suppliers",
        accessor: "Suppliers"
      },
      {
        Header: "Cost",
        accessor: d => Number(d.Cost)
      },
      {
        Header: "Count",
        accessor: d => Number(d.Count)
      },
  ],
  []
)
const [skipPageReset, setSkipPageReset] = React.useState(false)
//array of items used in table
const [data, setData] = React.useState([])
//object of changes. Keys = item.id : Values = item.data
const [changes, setChanges] = React.useState({})
//on editted data, used to revert changes
const [originalData, setOriginalData] = React.useState(data)

const [checkbox, setCheckbox] = React.useState(false)

// We need to keep the table from resetting the pageIndex when we
// Update data. So we can keep track of that flag with a ref.

// When our cell renderer calls updateMyData, we'll use
// the rowIndex, columnId and new value to update the
// original data
const updateData = (rowIndex, columnId, value) => {
  // We also turn on the flag to not reset the page
  setSkipPageReset(true)
  setData(old =>
    old.map((row, index) => {
      if (index === rowIndex) {
        //if old and new values are different AND they aren't both empty/null values
        if (!(old[rowIndex][columnId] === value) && !(!value && !old[rowIndex][columnId])) {
          var item = JSON.parse(JSON.stringify(old[rowIndex]))
          updateChanges(item, columnId, value)
          return {
            ...old[rowIndex],
            [columnId]: value,
          }
        } 
      }
      return row
    })
  )
}

const updateChanges = (item, columnId, value) => {
  var initialCount = Number(item.Count)
  if (columnId === 'Suppliers') {
    item[columnId] = value.split(',') 
  } else {
    item[columnId] = value
  }
  var id = item.id
  delete item.id
  //initial change
  if (!changes[id]) {
    setChanges({
      ...changes,
      [id]: {
        item: item,
        type: columnId,
        initialCount: initialCount,
        newCount: Number(value)
      }
    })
  //if change exists and count was changed
  } else if (columnId === 'Count') { 
    setChanges({
      ...changes,
      [id]: {
        item: item,
        type: 'Count',
        initialCount: changes[id].initialCount,
        newCount: Number(value)
      }
    })
  } else {
    setChanges({
      ...changes,
      [id]: {
        item: item,
        type: changes[id].type,
        initialCount: changes[id].initialCount,
        newCount: changes[id].newCount
      }
    })
  }
}

const resetChanges = () => {
  setData(originalData)
  setChanges({})
}

const saveChanges = () => {
  if (window.confirm("Confirm "+Object.keys(changes).length+" change(s) to the database?")) {
    for (var id in changes) {
      if (changes[id].type === 'delete') {
        firestore.collection("Items").doc(id).delete()
      } else {
        var changeCount = Number(changes[id].newCount - changes[id].initialCount)
        var ref = firestore.collection('Items').doc(id)
        ref.set(changes[id].item)
        if (changes[id].type === 'Count'){
          updateInventory(id,changes[id].item.Name,changes[id].item.Count,changeCount,changes[id].item.Cost) 
        }
      }
    }
    setOriginalData(data)
    setChanges({})
  }
}

const deleteRows = (selectedRows) => {
  var newData = JSON.parse(JSON.stringify(data))
  var newChanges = JSON.parse(JSON.stringify(changes))
  var count = 0
  for (var idx in selectedRows) {
    var rowIdx = Number(selectedRows[idx]) - count
    var id = newData[rowIdx].id
    newChanges[id] = {type: 'delete'}
    newData.splice(rowIdx,1)
    count = count + 1
  }
  setChanges(newChanges)
  setData(newData)
}

const addItem = () => {
  var item = {
    id : uuidv4(),
    Name : null,
    Type : null,
    Serial : null,
    SubType : null,
    Percentage : 0,
    Year : null,
    Unit : null,
    Suppliers : null,
    Cost : 0,
    Count : 0
  }
  setData([item,...data])
}

const checkedBox = () => {
  if (checkbox) {
    setCheckbox(false)
  } else {
    setCheckbox(true)
  }
}

const fetchNewData = () => {
  var searchName = document.getElementById("inlineFormInputName2").value
  var searchType = document.getElementById("inlineFormCustomSelectPref").value
  fetchItems(searchName,searchType,checkbox).then((newData) => {
    setData(newData)
    setOriginalData(newData)
    setChanges({})
  })
}

// After data chagnes, we turn the flag back off
// so that if data actually changes when we're not
// editing it, the page is reset
React.useEffect(() => {
  setSkipPageReset(false)
}, [data])

return (
  <div >
    <div style={{display: 'flex', justifyContent: 'center'}}>
    <Form inline fluid="true">
      <Form.Control as="select" className="m-1" id="inlineFormCustomSelectPref" custom >
        <option value="Name">Name</option>
        <option value="Type">Type</option>
        <option value="SubType">SubType</option>
        <option value="Percentage">Percentage</option>
        <option value="Year">Year</option>
        <option value="Unit">Unit</option>
        <option value="Suppliers">Suppliers</option>
        <option value="Cost">Cost</option>
        <option value="Count">Count</option>
      </Form.Control>
      <Form.Control
        className="m-1"
        id="inlineFormInputName2"
        placeholder="Example "
      />
      <Button onClick={fetchNewData} className="m-1" id="searchType">
        Fetch Items
      </Button>
      <div class="custom-control custom-checkbox ml-2">
        <input type="checkbox" class="custom-control-input" id="defaultUnchecked" onClick={checkedBox}/>
        <label class="custom-control-label" for="defaultUnchecked">Show Inactive</label>
      </div>
    </Form>
    </div>
    <Table 
      columns={columns} 
      data={data} 
      updateData={updateData}
      skipPageReset={skipPageReset}
      deleteRows={deleteRows}
      addItem={addItem}
      saveChanges={saveChanges}
      resetChanges={resetChanges}
    />
  </div>
)
}