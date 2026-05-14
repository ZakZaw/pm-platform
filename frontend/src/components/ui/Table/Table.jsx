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
  return <table className={classes}>{children}</table>;
}

Table.Head = function TableHead({ children }) {
  return <thead className="table__head">{children}</thead>;
};

Table.Body = function TableBody({ children }) {
  return <tbody className="table__body">{children}</tbody>;
};

Table.Row = function TableRow({ children, ...rest }) {
  return (
    <tr className="table__row" {...rest}>
      {children}
    </tr>
  );
};

Table.Header = function TableHeader({ children, align, className = '' }) {
  const classes = ['table__header', align ? `table__cell--${align}` : '', className]
    .filter(Boolean)
    .join(' ');
  return <th className={classes}>{children}</th>;
};

Table.Cell = function TableCell({ children, align, className = '' }) {
  const classes = ['table__cell', align ? `table__cell--${align}` : '', className]
    .filter(Boolean)
    .join(' ');
  return <td className={classes}>{children}</td>;
};
