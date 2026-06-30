interface TableIntroProps {
  title: string;
  text: string;
}

const TableIntro = ({ title, text }: TableIntroProps) => {
  return (
    <div className="grid gap-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
};

export default TableIntro;
