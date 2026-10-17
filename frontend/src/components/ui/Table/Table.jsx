import './Table.css';

// Composition-only. Use as:
//   <Table>
//     <Table.Head>
//       <Table.Row><Table.Header>Name</Table.Header>...</Table.Row>
//     </Table.Head>
//     <Table.Body>
//       <Table.Row><Table.Cell>...</Table.Cell></Table.Row>
//     </Table.Body>
//   </Table>
export function Table({ className = '', children }) {
  const classes = ['table', className].filter(Boolean).join(' ');
  // The wrapper carries the card chrome and scrolls sideways on narrow screens.
  return (
    <div className="table-wrap">
      <table className={classes}>{children}</table>
    </div>
  );
}

Table.Head = function TableHead({ children }) {
  return <thead className="table-head">{children}</thead>;
};

Table.Body = function TableBody({ children }) {
  return <tbody className="table-body">{children}</tbody>;
};

Table.Row = function TableRow({ children, ...rest }) {
  return (
    <tr className="table-row" {...rest}>
      {children}
    </tr>
  );
};

Table.Header = function TableHeader({ children, align, className = '' }) {
  const classes = ['table-header', align ? `table-cell-${align}` : '', className]
    .filter(Boolean)
    .join(' ');
  return <th className={classes}>{children}</th>;
};

Table.Cell = function TableCell({ children, align, className = '' }) {
  const classes = ['table-cell', align ? `table-cell-${align}` : '', className]
    .filter(Boolean)
    .join(' ');
  return <td className={classes}>{children}</td>;
};
