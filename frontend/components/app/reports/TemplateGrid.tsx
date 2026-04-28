import { TEMPLATES } from "@/lib/reports-data";
import { SectionHead } from "@/components/ui/SectionHead";
import { TemplateCard } from "./TemplateCard";
import styles from "./TemplateGrid.module.css";

/** Templates row above the reports list — pre-built layouts a user
 *  can pick to start a new report. */
export function TemplateGrid() {
  return (
    <section className={styles.section}>
      <SectionHead
        title="Start from a template"
        subtitle="pre-configured layouts for common workflows"
      />
      <div className={styles.grid}>
        {TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </section>
  );
}
