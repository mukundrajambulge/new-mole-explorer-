#!/usr/bin/env python3
"""Read-only mmCIF inventory for D3-PREP-CAND-02. No coordinate mutation."""
from __future__ import annotations
import hashlib, json, re, sys
from collections import defaultdict

class Tok:
    __slots__=("v","line","quoted")
    def __init__(self,v,line,quoted=False): self.v,self.line,self.quoted=v,line,quoted

def tokenize(path):
    lines=open(path,encoding="utf-8",errors="replace").read().splitlines()
    out=[]; i=0
    while i<len(lines):
        line=lines[i]
        if line.startswith(";"):
            start=i+1; buf=[line[1:]]; i+=1
            while i<len(lines) and not lines[i].startswith(";"):
                buf.append(lines[i]); i+=1
            out.append(Tok("\n".join(buf),start,True)); i+=1; continue
        j=0; n=len(line)
        while j<n:
            while j<n and line[j].isspace(): j+=1
            if j>=n or line[j]=="#": break
            if line[j] in ("'",'"'):
                q=line[j]; start=j+1; j+=1
                while j<n:
                    if line[j]==q and (j+1==n or line[j+1].isspace() or line[j+1]=="#"): break
                    j+=1
                out.append(Tok(line[start:j],i+1,True)); j+=1
            else:
                start=j
                while j<n and not line[j].isspace(): j+=1
                out.append(Tok(line[start:j],i+1,False))
        i+=1
    return out

def parse(path):
    ts=tokenize(path); data={"scalars":{},"loops":defaultdict(list)}
    i=0
    def control(t):
        if t.quoted:return False
        v=t.v.lower()
        return v=="loop_" or v=="stop_" or v.startswith("data_") or v.startswith("save_") or v.startswith("_")
    while i<len(ts):
        v=ts[i].v
        if not ts[i].quoted and v.lower()=="loop_":
            i+=1; tags=[]
            while i<len(ts) and not ts[i].quoted and ts[i].v.startswith("_"):
                tags.append(ts[i].v); i+=1
            if not tags: continue
            flat=[]
            while i<len(ts):
                if len(flat)%len(tags)==0 and control(ts[i]): break
                flat.append(ts[i]); i+=1
            cat=tags[0].split(".",1)[0]
            for k in range(0,len(flat)-len(flat)%len(tags),len(tags)):
                data["loops"][cat].append({tag:flat[k+j].v for j,tag in enumerate(tags)})
            if i<len(ts) and not ts[i].quoted and ts[i].v.lower()=="stop_": i+=1
        elif not ts[i].quoted and v.startswith("_"):
            tag=v; i+=1
            if i<len(ts): data["scalars"][tag]=ts[i].v; i+=1
        else: i+=1
    return data

def rows(d,cat):
    key="_"+cat
    result=list(d["loops"].get(key,[]))
    scalar={tag:value for tag,value in d["scalars"].items() if tag.startswith(key+".")}
    if scalar: result.append(scalar)
    return result
def val(d,tag,default=""): return d["scalars"].get("_"+tag,default)
def col(row,name,default=""): return row.get(name,default)
def norm(v): return v not in ("",".","?")
def num(v):
    try:return float(v)
    except:return None
def xyz(row):
    return tuple(num(row.get(k,"")) for k in ("_atom_site.Cartn_x","_atom_site.Cartn_y","_atom_site.Cartn_z"))
def dist(a,b):
    if any(x is None for x in a+b):return None
    return sum((x-y)**2 for x,y in zip(a,b))**0.5
def oneletter(seq):
    s=re.sub(r"\s+","",seq)
    return s.replace(";","")

def audit(path,ligid):
    d=parse(path)
    raw=open(path,"rb").read()
    atoms=rows(d,"atom_site")
    comp=rows(d,"chem_comp")
    comp_atom=rows(d,"chem_comp_atom")
    comp_bond=rows(d,"chem_comp_bond")
    aa_names={r.get("_chem_comp.id","") for r in comp if r.get("_chem_comp.type","").lower().find("peptide")>=0}
    # polymer entities/asym chains
    entseq=defaultdict(list)
    for r in rows(d,"entity_poly_seq"):
        entseq[r.get("_entity_poly_seq.entity_id","")].append(r)
    poly={r.get("_entity_poly.entity_id",""):r for r in rows(d,"entity_poly")}
    asyment={r.get("_struct_asym.id",""):r.get("_struct_asym.entity_id","") for r in rows(d,"struct_asym")}
    assembly=[]
    for r in rows(d,"pdbx_struct_assembly"):
        assembly.append({k.split(".",1)[1]:v for k,v in r.items()})
    assembly_gen=[]
    for r in rows(d,"pdbx_struct_assembly_gen"):
        assembly_gen.append({k.split(".",1)[1]:v for k,v in r.items()})
    models=sorted({a.get("_atom_site.pdbx_PDB_model_num","1") for a in atoms})
    # Target ligand component graph/state
    cc={r.get("_chem_comp.id",""):r for r in comp}
    lig_atoms=[r for r in comp_atom if r.get("_chem_comp_atom.comp_id")==ligid]
    lig_bonds=[r for r in comp_bond if r.get("_chem_comp_bond.comp_id")==ligid]
    ligand_instances=defaultdict(list)
    for a in atoms:
        if a.get("_atom_site.label_comp_id")==ligid and a.get("_atom_site.group_PDB","") in ("HETATM","ATOM"):
            key=(a.get("_atom_site.label_asym_id",""),a.get("_atom_site.auth_asym_id",""),a.get("_atom_site.auth_seq_id",""),a.get("_atom_site.pdbx_PDB_model_num","1"))
            ligand_instances[key].append(a)
    targetrows=[]
    for r in rows(d,"pdbx_nonpoly_scheme"):
        if r.get("_pdbx_nonpoly_scheme.mon_id")==ligid:
            targetrows.append({k.split(".",1)[1]:v for k,v in r.items()})
    ligand_coords=[]
    for a in atoms:
        if a.get("_atom_site.label_comp_id")==ligid and a.get("_atom_site.pdbx_PDB_model_num","1")==models[0]:
            ligand_coords.append((a,xyz(a)))
    lig_occ=[num(a.get("_atom_site.occupancy","")) for a,_ in ligand_coords]
    # residue/site completeness, altlocs, contacts
    protein_asym_ids={asym for asym,eid in asyment.items() if eid in poly and "polypeptide" in poly[eid].get("_entity_poly.type","").lower()}
    observed=defaultdict(lambda:{"atoms":set(),"altlocs":set(),"occupancies":[],"comp":""})
    obspos=defaultdict(set)
    missing_res=[]
    for r in rows(d,"pdbx_unobs_or_zero_occ_residues"):
        missing_res.append({k.split(".",1)[1]:v for k,v in r.items()})
    missing_atoms=[]
    for r in rows(d,"pdbx_unobs_or_zero_occ_atoms"):
        missing_atoms.append({k.split(".",1)[1]:v for k,v in r.items()})
    for a in atoms:
        asym=a.get("_atom_site.label_asym_id","")
        if asym not in protein_asym_ids or a.get("_atom_site.pdbx_PDB_model_num","1")!=models[0]: continue
        seq=a.get("_atom_site.label_seq_id","")
        auth=a.get("_atom_site.auth_seq_id","")
        compid=a.get("_atom_site.label_comp_id","")
        key=(asym,seq,auth,compid)
        o=observed[key]; o["comp"]=compid
        o["atoms"].add(a.get("_atom_site.label_atom_id",""))
        alt=a.get("_atom_site.label_alt_id","")
        if norm(alt):o["altlocs"].add(alt)
        occ=num(a.get("_atom_site.occupancy",""))
        if occ is not None:o["occupancies"].append(occ)
        if norm(seq):obspos[asym].add(int(float(seq)))
    # expected heavy atoms by CCD chem comp dictionary
    expected=defaultdict(set)
    element={}
    for r in comp_atom:
        cid=r.get("_chem_comp_atom.comp_id","")
        aid=r.get("_chem_comp_atom.atom_id","")
        el=r.get("_chem_comp_atom.type_symbol","").upper()
        element[(cid,aid)]=el
        if cid and aid and el not in ("H","D") and aid != "OXT":expected[cid].add(aid)
    missing_heavy=[]
    for (asym,seq,auth,cid),o in observed.items():
        exp=expected.get(cid,set())
        if not exp:continue
        absent=sorted(exp-o["atoms"])
        if absent:
            missing_heavy.append({"asym":asym,"seq":seq,"auth":auth,"comp":cid,"missing":absent})
    # Entity coverage summaries
    polys=[]
    for asym,eid in sorted(asyment.items()):
        if eid not in poly or "polypeptide" not in poly[eid].get("_entity_poly.type","").lower():continue
        seqrows=sorted(entseq[eid],key=lambda r:int(r.get("_entity_poly_seq.num","0")))
        positions={int(r.get("_entity_poly_seq.num","0")) for r in seqrows}
        obs=obspos.get(asym,set())
        absent=sorted(positions-obs)
        miss_asym=[m for m in missing_res if m.get("label_asym_id")==asym]
        seqtxt=oneletter(poly[eid].get("_entity_poly.pdbx_seq_one_letter_code_can",""))
        polys.append({"asym":asym,"entity":eid,"entity_description":next((e.get("_entity.pdbx_description","") for e in rows(d,"entity") if e.get("_entity.id")==eid),""),"polymer_type":poly[eid].get("_entity_poly.type",""),"seq_len":len(seqrows),"observed_label_positions":len(obs),"missing_label_positions":absent,"first_expected":min(positions) if positions else None,"last_expected":max(positions) if positions else None,"first_observed":min(obs) if obs else None,"last_observed":max(obs) if obs else None,"declared_seq_one_letter":seqtxt,"unobs_rows_count":len(miss_asym)})
    # alternate residues and insertion-code/chainbreak indicators
    altres=[]
    for key,o in observed.items():
        if o["altlocs"]:
            alts=sorted(o["altlocs"])
            altres.append({"asym":key[0],"seq":key[1],"auth":key[2],"comp":key[3],"altlocs":alts,"occupancy_min":min(o["occupancies"]) if o["occupancies"] else None,"occupancy_max":max(o["occupancies"]) if o["occupancies"] else None})
    chainbreaks=[]
    for asym in protein_asym_ids:
        ps=sorted(obspos.get(asym,set()))
        gaps=[(a,b) for a,b in zip(ps,ps[1:]) if b>a+1]
        if gaps:chainbreaks.append({"asym":asym,"gaps":gaps})
    # component instances and distances from ligand instances
    ligand_inst_summary=[]
    comp_groups=defaultdict(list)
    residue_groups=defaultdict(list)
    for a in atoms:
        k=(a.get("_atom_site.label_comp_id",""),a.get("_atom_site.label_asym_id",""),a.get("_atom_site.auth_asym_id",""),a.get("_atom_site.auth_seq_id",""),a.get("_atom_site.pdbx_PDB_model_num","1"))
        comp_groups[k].append(a)
        if a.get("_atom_site.label_seq_id","") not in ("",".","?"):
            rk=(a.get("_atom_site.label_asym_id",""),a.get("_atom_site.label_seq_id",""),a.get("_atom_site.label_comp_id",""),a.get("_atom_site.pdbx_PDB_model_num","1"))
            residue_groups[rk].append(a)
    residue_proximity=[]
    for ik,ilatoms in sorted(ligand_instances.items()):
        lcoords=[xyz(a) for a in ilatoms if a.get("_atom_site.pdbx_PDB_model_num","1")==models[0]]
        contacts=[]
        for k,ga in comp_groups.items():
            cid,asym,authasym,authseq,model=k
            if cid==ligid or model!=models[0] or not all(cid):continue
            coords=[xyz(a) for a in ga if a.get("_atom_site.type_symbol","").upper() not in ("H","D")]
            ds=[dist(x,y) for x in lcoords for y in coords]
            ds=[x for x in ds if x is not None]
            if ds and min(ds)<=8.0:
                contacts.append({"comp":cid,"asym":asym,"auth_asym":authasym,"auth_seq":authseq,"min_dist_A":round(min(ds),3),"atoms":len(ga)})
        contacts=sorted(contacts,key=lambda x:x["min_dist_A"])
        waters_near=[x for x in contacts if x["comp"] in ("HOH","DOD")]
        for (asym,seq,auth,cid),o in observed.items():
            if asym not in protein_asym_ids or not seq: continue
            rg=residue_groups.get((asym,seq,cid,models[0]),[])
            rcoords=[xyz(a) for a in rg if a.get("_atom_site.type_symbol","").upper() not in ("H","D")]
            ds=[dist(x,y) for x in lcoords for y in rcoords]
            ds=[x for x in ds if x is not None]
            if ds:
                residue_proximity.append({"label_asym":asym,"label_seq":seq,"auth_seq":auth,"comp":cid,"min_dist_A":round(min(ds),3),"has_altloc":bool(o["altlocs"]),"missing_heavy_atoms":sorted(expected.get(cid,set())-o["atoms"])})
        ligand_inst_summary.append({"instance":{"label_asym":ik[0],"auth_asym":ik[1],"auth_seq":ik[2],"model":ik[3]},"coordinate_atom_records":len(ilatoms),"heavy_atom_records":sum(1 for a in ilatoms if a.get("_atom_site.type_symbol","").upper() not in ("H","D")),"altlocs":sorted({a.get("_atom_site.label_alt_id","") for a in ilatoms if norm(a.get("_atom_site.label_alt_id",""))}),"occupancy_values":sorted({a.get("_atom_site.occupancy","") for a in ilatoms}),"nearby_water_count_le_5A":sum(1 for x in waters_near if x["min_dist_A"]<=5.0),"nearby_water_count_le_8A":sum(1 for x in waters_near if x["min_dist_A"]<=8.0),"near_components":contacts[:100]})
    # other HET/component inventory
    nonpoly=defaultdict(lambda:{"instances":set(),"atoms":0})
    for a in atoms:
        if a.get("_atom_site.group_PDB")!="HETATM":continue
        cid=a.get("_atom_site.label_comp_id","")
        if cid in ("HOH","DOD"):continue
        nonpoly[cid]["instances"].add((a.get("_atom_site.label_asym_id",""),a.get("_atom_site.auth_asym_id",""),a.get("_atom_site.auth_seq_id","")))
        nonpoly[cid]["atoms"]+=1
    waters=[a for a in atoms if a.get("_atom_site.label_comp_id") in ("HOH","DOD")]
    # source metadata
    resolutions=[num(r.get("_refine.ls_d_res_high","")) for r in rows(d,"refine")]
    exptl=[r.get("_exptl.method","") for r in rows(d,"exptl")]
    revision=rows(d,"pdbx_audit_revision_history")
    struct_ref=[{k.split(".",1)[1]:v for k,v in r.items()} for r in rows(d,"struct_ref")]
    struct_ref_dif=[{k.split(".",1)[1]:v for k,v in r.items()} for r in rows(d,"struct_ref_seq_dif")]
    dbstatus=rows(d,"pdbx_database_status")
    chem=cc.get(ligid,{})
    ligand_graph={"component":ligid,"name":chem.get("_chem_comp.name",""),"type":chem.get("_chem_comp.type",""),"formula":chem.get("_chem_comp.formula",""),"formula_weight":chem.get("_chem_comp.formula_weight",""),"formal_charge":chem.get("_chem_comp.pdbx_formal_charge",""),"atom_count_ccd":len(lig_atoms),"heavy_atom_count_ccd":sum(1 for a in lig_atoms if a.get("_chem_comp_atom.type_symbol","").upper() not in ("H","D")),"atom_definitions":[{"atom":a.get("_chem_comp_atom.atom_id"),"element":a.get("_chem_comp_atom.type_symbol"),"charge":a.get("_chem_comp_atom.charge"),"stereo":a.get("_chem_comp_atom.pdbx_stereo_config")} for a in lig_atoms],"bonds":[{"a":b.get("_chem_comp_bond.atom_id_1"),"b":b.get("_chem_comp_bond.atom_id_2"),"order":b.get("_chem_comp_bond.value_order"),"aromatic":b.get("_chem_comp_bond.pdbx_aromatic_flag"),"stereo":b.get("_chem_comp_bond.pdbx_stereo_config")} for b in lig_bonds]}
    crystal_grow=[{k.split(".",1)[1]:v for k,v in r.items()} for r in rows(d,"exptl_crystal_grow")]
    revision_dates=sorted(r.get("_pdbx_audit_revision_history.revision_date","") for r in revision if norm(r.get("_pdbx_audit_revision_history.revision_date","")))
    source=[]
    for cat in ("entity_src_nat","entity_src_gen","pdbx_entity_src_syn"):
        for r in rows(d,cat):
            source.append({"category":cat,**{k.split(".",1)[1]:v for k,v in r.items() if any(s in k for s in ("entity_id","pdbx_src_id","pdbx_alt_source_flag","pdbx_seq_type","pdbx_gene_src_scientific_name","pdbx_host_org_scientific_name","gene_src_scientific_name","pdbx_description","details","organism_scientific"))}})
    disulfides=[{k.split(".",1)[1]:v for k,v in r.items()} for r in rows(d,"struct_conn") if "disulf" in r.get("_struct_conn.conn_type_id","").lower()]
    return {"source_sha256":hashlib.sha256(raw).hexdigest(),"file_bytes":len(raw),"file":path,"entry_id":val(d,"entry.id"),"title":val(d,"struct.title"),"method":exptl,"resolution_A":min((x for x in resolutions if x is not None),default=None),"models":models,"revision_history":[{k.split(".",1)[1]:v for k,v in r.items()} for r in revision],"initial_deposition_date":dbstatus[0].get("_pdbx_database_status.recvd_initial_deposition_date","") if dbstatus else "","first_revision_date":revision_dates[0] if revision_dates else "","latest_revision_date":revision_dates[-1] if revision_dates else "","crystal_growth":crystal_grow,"source_records":source,"assembly":assembly,"assembly_gen":assembly_gen,"polymer_entities":polys,"struct_ref":struct_ref,"struct_ref_seq_dif":struct_ref_dif,"missing_residue_records":missing_res,"missing_atom_records":missing_atoms,"missing_standard_heavy_atoms":missing_heavy,"alternate_residues":altres,"chainbreaks":chainbreaks,"disulfide_connections":disulfides,"ligand":ligand_graph,"ligand_instances":ligand_inst_summary,"residue_proximity":residue_proximity,"nonpolymer_counts":{k:{"instances":len(v["instances"]),"atoms":v["atoms"]} for k,v in sorted(nonpoly.items())},"water_atom_records":len(waters),"target_scheme_instances":targetrows}
def main():
    out={}
    for arg in sys.argv[1:]:
        code,ligid=arg.split(":",1)
        out[code]=audit(f"verification/d3-prep-cand-02/source_artifacts/{code}.cif",ligid)
    print(json.dumps(out,indent=2,ensure_ascii=False))
if __name__=="__main__":main()
